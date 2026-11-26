import Foundation
import UIKit
import Capacitor
import ImageIO
import CoreImage
import UniformTypeIdentifiers
import PDFKit
import Vision
import AVFoundation
import CoreText
import QuickLook

private final class OmniQuickLookCoordinator: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
    let fileURL: URL
    var onDismiss: (() -> Void)?

    init(fileURL: URL, onDismiss: (() -> Void)? = nil) {
        self.fileURL = fileURL
        self.onDismiss = onDismiss
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        return 1
    }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        return fileURL as QLPreviewItem
    }

    func previewControllerDidDismiss(_ controller: QLPreviewController) {
        try? FileManager.default.removeItem(at: fileURL)
        onDismiss?()
    }
}

@objc(OmniNativeEnginePlugin)
public class OmniNativeEnginePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmniNativeEnginePlugin"
    public let jsName = "OmniNativeEngine"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNativeAppearance", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "convertImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeTextOcr", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "convertMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "videoToGif", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pdfToImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "textToVectorPdf", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "renderPdfPreviewPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openQuickLook", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cleanupTempWorkspace", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSharedInboxFiles", returnType: CAPPluginReturnPromise)
    ]

    private var activeQuickLookCoordinator: OmniQuickLookCoordinator?

    @objc public func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "platform": "ios",
            "osVersion": UIDevice.current.systemVersion
        ])
    }

    /// Keeps native UIWindow, WKWebView, and UIScrollView background synced with in-app Light/Dark/AMOLED theme.
    @objc public func setNativeAppearance(_ call: CAPPluginCall) {
        let mode = call.getString("theme") ?? "system"
        DispatchQueue.main.async {
            if let mainVC = self.bridge?.viewController as? MainViewController {
                mainVC.applyThemeMode(mode)
            }
            call.resolve(["applied": mode])
        }
    }

    /// Native Apple QuickLook (QLPreviewController) for crisp pinch-zoom preview of PDF, DOCX, XLSX, HEIC, MP4, M4A, ZIP.
    @objc public func openQuickLook(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64Data"),
              let fileData = Data(base64Encoded: base64) else {
            call.reject("Invalid base64 data for QuickLook")
            return
        }
        let rawName = call.getString("fileName") ?? "preview.bin"
        let safeName = rawName.replacingOccurrences(of: "/", with: "_")
        let previewDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("omniconvert_ql", isDirectory: true)
        try? FileManager.default.createDirectory(at: previewDir, withIntermediateDirectories: true)
        let fileURL = previewDir.appendingPathComponent("\(UUID().uuidString)_\(safeName)")

        do {
            try fileData.write(to: fileURL, options: .atomic)
        } catch {
            call.reject("Failed to stage preview file: \(error.localizedDescription)")
            return
        }

        DispatchQueue.main.async {
            guard let hostVC = self.bridge?.viewController else {
                try? FileManager.default.removeItem(at: fileURL)
                call.reject("View controller unavailable")
                return
            }

            let coordinator = OmniQuickLookCoordinator(fileURL: fileURL) { [weak self] in
                self?.activeQuickLookCoordinator = nil
            }
            self.activeQuickLookCoordinator = coordinator

            let ql = QLPreviewController()
            ql.dataSource = coordinator
            ql.delegate = coordinator
            hostVC.present(ql, animated: true) {
                call.resolve(["presented": true])
            }
        }
    }

    /// Tier 1 Hardware Image Conversion via Apple ImageIO / CoreImage
    /// Bakes EXIF orientation BEFORE stripping EXIF/GPS so portrait iPhone photos never rotate sideways.
    @objc public func convertImage(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64Data"),
              let inputData = Data(base64Encoded: base64) else {
            call.reject("Invalid base64 image input")
            return
        }

        let targetFormat = (call.getString("targetFormat") ?? "jpg").lowercased()
        let quality = max(10, min(100, call.getInt("quality") ?? 85))
        let maxDim = call.getInt("maxDimension")
        let stripExif = call.getBool("stripExif") ?? true

        DispatchQueue.global(qos: .userInitiated).async {
            guard let source = CGImageSourceCreateWithData(inputData as CFData, nil) else {
                call.reject("ImageIO could not decode image source")
                return
            }

            // Read intrinsic pixel dimensions to bake EXIF orientation accurately even when not resizing
            let propsDict = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
            let srcW = propsDict?[kCGImagePropertyPixelWidth] as? Int ?? 4096
            let srcH = propsDict?[kCGImagePropertyPixelHeight] as? Int ?? 4096
            let intrinsicMax = max(srcW, srcH, 1)
            let effectiveMax = (maxDim != nil && maxDim! > 0) ? min(maxDim!, intrinsicMax) : intrinsicMax

            let thumbOpts: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: effectiveMax
            ]
            let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbOpts as CFDictionary)
                ?? CGImageSourceCreateImageAtIndex(source, 0, nil)

            guard let decoded = cgImage else {
                call.reject("ImageIO failed to rasterize frame")
                return
            }

            let utType: UTType
            let outMime: String
            switch targetFormat {
            case "png":
                utType = .png
                outMime = "image/png"
            case "heic":
                utType = .heic
                outMime = "image/heic"
            case "tiff", "tif":
                utType = .tiff
                outMime = "image/tiff"
            case "webp":
                utType = .webP
                outMime = "image/webp"
            default:
                utType = .jpeg
                outMime = "image/jpeg"
            }

            let outputData = NSMutableData()
            guard let destination = CGImageDestinationCreateWithData(
                outputData,
                utType.identifier as CFString,
                1,
                nil
            ) else {
                call.reject("ImageIO destination unsupported for \(targetFormat)")
                return
            }

            var renderImage = decoded
            // Flatten alpha onto white when exporting transparent PNG/TIFF/HEIC to opaque JPEG
            if utType == .jpeg {
                let alpha = decoded.alphaInfo
                if alpha == .first || alpha == .last || alpha == .premultipliedFirst || alpha == .premultipliedLast {
                    let w = decoded.width
                    let h = decoded.height
                    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
                    if let ctx = CGContext(
                        data: nil,
                        width: w,
                        height: h,
                        bitsPerComponent: 8,
                        bytesPerRow: 0,
                        space: colorSpace,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
                    ) {
                        ctx.setFillColor(UIColor.white.cgColor)
                        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
                        ctx.draw(decoded, in: CGRect(x: 0, y: 0, width: w, height: h))
                        if let flattened = ctx.makeImage() {
                            renderImage = flattened
                        }
                    }
                }
            }

            var props: [CFString: Any] = [
                kCGImageDestinationLossyCompressionQuality: Double(quality) / 100.0,
                kCGImageDestinationOptimizeColorForSharing: true
            ]
            if stripExif {
                props[kCGImagePropertyExifDictionary] = kCFNull
                props[kCGImagePropertyGPSDictionary] = kCFNull
                props[kCGImagePropertyTIFFDictionary] = kCFNull
                props[kCGImagePropertyIPTCDictionary] = kCFNull
                props[kCGImagePropertyOrientation] = 1
            }

            CGImageDestinationAddImage(destination, renderImage, props as CFDictionary)
            guard CGImageDestinationFinalize(destination) else {
                call.reject("ImageIO failed to finalize encoded output")
                return
            }

            let bytes = outputData as Data
            call.resolve([
                "base64Data": bytes.base64EncodedString(),
                "mime": outMime,
                "sizeBytes": bytes.count
            ])
        }
    }

    /// Tier 1 On-Device Offline OCR via Apple Vision (VNRecognizeTextRequest)
    @objc public func recognizeTextOcr(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64Data"),
              let inputData = Data(base64Encoded: base64) else {
            call.reject("Invalid base64 input for Vision OCR")
            return
        }

        let sourceFormat = (call.getString("sourceFormat") ?? "png").lowercased()
        let lang = (call.getString("language") ?? "tr").lowercased()
        let recognitionLangs: [String]
        switch lang {
        case "tr": recognitionLangs = ["tr-TR", "en-US"]
        case "de": recognitionLangs = ["de-DE", "en-US"]
        case "es": recognitionLangs = ["es-ES", "en-US"]
        default: recognitionLangs = ["en-US"]
        }

        DispatchQueue.global(qos: .userInitiated).async {
            var imagesToScan: [CGImage] = []

            if sourceFormat == "pdf", let pdfDoc = PDFDocument(data: inputData) {
                let pageCap = min(pdfDoc.pageCount, 30)
                for idx in 0..<pageCap {
                    guard let page = pdfDoc.page(at: idx) else { continue }
                    let bounds = page.bounds(for: .mediaBox)
                    let scale: CGFloat = 2.0
                    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
                    let renderer = UIGraphicsImageRenderer(size: size)
                    let img = renderer.image { ctx in
                        UIColor.white.set()
                        ctx.fill(CGRect(origin: .zero, size: size))
                        ctx.cgContext.translateBy(x: 0, y: size.height)
                        ctx.cgContext.scaleBy(x: scale, y: -scale)
                        page.draw(with: .mediaBox, to: ctx.cgContext)
                    }
                    if let cg = img.cgImage {
                        imagesToScan.append(cg)
                    }
                }
            } else if let uiImage = UIImage(data: inputData), let cg = uiImage.cgImage {
                imagesToScan.append(cg)
            }

            guard !imagesToScan.isEmpty else {
                call.reject("Could not extract raster frames for Vision OCR")
                return
            }

            var pageTexts: [String] = []
            var totalConfidence: Float = 0
            var observationCount = 0

            for cgImage in imagesToScan {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = true
                request.recognitionLanguages = recognitionLangs

                let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
                do {
                    try handler.perform([request])
                    let observations = request.results ?? []
                    let lines = observations.compactMap { obs -> String? in
                        guard let top = obs.topCandidates(1).first else { return nil }
                        totalConfidence += top.confidence
                        observationCount += 1
                        return top.string
                    }
                    pageTexts.append(lines.joined(separator: "\n"))
                } catch {
                    call.reject("Vision OCR failed: \(error.localizedDescription)")
                    return
                }
            }

            let avgConfidence = observationCount > 0 ? totalConfidence / Float(observationCount) : 1.0
            call.resolve([
                "text": pageTexts.joined(separator: "\n\n---\n\n"),
                "confidence": avgConfidence
            ])
        }
    }

    /// Fast hardware PDFKit single-page renderer for inline multi-page preview (1-based pageNumber)
    @objc public func renderPdfPreviewPage(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64Data"),
              let inputData = Data(base64Encoded: base64),
              let pdfDoc = PDFDocument(data: inputData),
              pdfDoc.pageCount > 0 else {
            call.reject("PDFKit could not open PDF document")
            return
        }

        let requestedPage = max(1, min(pdfDoc.pageCount, call.getInt("pageNumber") ?? 1))
        let maxWidth = CGFloat(max(320, min(1800, call.getInt("maxWidth") ?? 1100)))

        DispatchQueue.global(qos: .userInitiated).async {
            guard let page = pdfDoc.page(at: requestedPage - 1) else {
                call.reject("Requested PDF page out of range")
                return
            }
            let bounds = page.bounds(for: .mediaBox)
            let safeW = max(bounds.width, 1)
            let safeH = max(bounds.height, 1)
            let scale = min(maxWidth / safeW, 2.5)
            let size = CGSize(width: safeW * scale, height: safeH * scale)
            let renderer = UIGraphicsImageRenderer(size: size)
            let image = renderer.image { ctx in
                UIColor.white.set()
                ctx.fill(CGRect(origin: .zero, size: size))
                ctx.cgContext.translateBy(x: 0, y: size.height)
                ctx.cgContext.scaleBy(x: scale, y: -scale)
                page.draw(with: .mediaBox, to: ctx.cgContext)
            }

            guard let jpgData = image.jpegData(compressionQuality: 0.86) else {
                call.reject("Failed to encode PDF preview page")
                return
            }

            call.resolve([
                "base64Data": jpgData.base64EncodedString(),
                "mime": "image/jpeg",
                "pageCount": pdfDoc.pageCount,
                "width": Int(size.width),
                "height": Int(size.height)
            ])
        }
    }

    /// Tier 1 Native Vector UTF-8 PDF Renderer (CoreText / UIGraphicsPDFRenderer)
    /// Produces crisp, 100% searchable Turkish/Unicode vector PDFs (~15 KB/page instead of bloated PNG pages).
    @objc public func textToVectorPdf(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        DispatchQueue.global(qos: .userInitiated).async {
            let pageRect = CGRect(x: 0, y: 0, width: 595.28, height: 841.89)
            let margin: CGFloat = 46.0
            let textRect = pageRect.insetBy(dx: margin, dy: margin)

            let paragraph = NSMutableParagraphStyle()
            paragraph.lineSpacing = 4.0
            paragraph.lineBreakMode = .byWordWrapping

            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 11.5),
                .foregroundColor: UIColor(red: 0.08, green: 0.1, blue: 0.14, alpha: 1.0),
                .paragraphStyle: paragraph
            ]
            let attributed = NSAttributedString(string: text.isEmpty ? " " : text, attributes: attrs)
            let framesetter = CTFramesetterCreateWithAttributedString(attributed as CFAttributedString)

            let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
            let data = renderer.pdfData { ctx in
                var currentRange = CFRange(location: 0, length: 0)
                let totalLen = attributed.length
                var pageSafety = 0
                while currentRange.location < totalLen && pageSafety < 200 {
                    pageSafety += 1
                    ctx.beginPage()
                    let cg = ctx.cgContext
                    cg.saveGState()
                    cg.textMatrix = .identity
                    cg.translateBy(x: 0, y: pageRect.height)
                    cg.scaleBy(x: 1.0, y: -1.0)

                    let flippedRect = CGRect(x: margin, y: margin, width: textRect.width, height: textRect.height)
                    let path = CGPath(rect: flippedRect, transform: nil)
                    let frame = CTFramesetterCreateFrame(framesetter, currentRange, path, nil)
                    CTFrameDraw(frame, cg)
                    cg.restoreGState()

                    let visible = CTFrameGetVisibleStringRange(frame)
                    if visible.length <= 0 { break }
                    currentRange = CFRange(location: currentRange.location + visible.length, length: 0)
                }
            }

            call.resolve([
                "base64Data": data.base64EncodedString(),
                "mime": "application/pdf",
                "sizeBytes": data.count
            ])
        }
    }

    /// Tier 1 Hardware PDFKit Page Rendering (PDF -> PNG/JPG)
    @objc public func pdfToImages(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64Data"),
              let inputData = Data(base64Encoded: base64),
              let pdfDoc = PDFDocument(data: inputData),
              let firstPage = pdfDoc.page(at: 0) else {
            call.reject("PDFKit could not open PDF document")
            return
        }

        let targetFormat = (call.getString("targetFormat") ?? "png").lowercased()
        let dpi = max(72, min(300, call.getInt("dpi") ?? 150))

        DispatchQueue.global(qos: .userInitiated).async {
            let bounds = firstPage.bounds(for: .mediaBox)
            let scale = CGFloat(dpi) / 72.0
            let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
            let renderer = UIGraphicsImageRenderer(size: size)
            let image = renderer.image { ctx in
                UIColor.white.set()
                ctx.fill(CGRect(origin: .zero, size: size))
                ctx.cgContext.translateBy(x: 0, y: size.height)
                ctx.cgContext.scaleBy(x: scale, y: -scale)
                firstPage.draw(with: .mediaBox, to: ctx.cgContext)
            }

            let outData: Data?
            let mime: String
            if targetFormat == "jpg" || targetFormat == "jpeg" {
                outData = image.jpegData(compressionQuality: 0.88)
                mime = "image/jpeg"
            } else {
                outData = image.pngData()
                mime = "image/png"
            }

            guard let data = outData else {
                call.reject("Failed to encode rendered PDF page")
                return
            }

            call.resolve([
                "base64Data": data.base64EncodedString(),
                "mime": mime,
                "sizeBytes": data.count
            ])
        }
    }

    /// Tier 1 Hardware Media Transcode via AVFoundation / VideoToolbox (Zero GPL)
    /// Supports MP4 (480p/720p/1080p), MOV, M4A audio extraction, M4R (30s iPhone ringtone), and PCM WAV.
    @objc public func convertMedia(_ call: CAPPluginCall) {
        guard let inputPath = call.getString("inputPath") else {
            call.reject("Missing inputPath")
            return
        }
        let targetFormat = (call.getString("targetFormat") ?? "mp4").lowercased()
        let resolution = (call.getString("resolution") ?? "720p").lowercased()
        let maxDurationSec = call.getDouble("maxDurationSec")

        let inputURL = URL(fileURLWithPath: inputPath)
        let asset = AVURLAsset(url: inputURL)

        if targetFormat == "wav" {
            exportAudioToWav(asset: asset, call: call)
            return
        }

        // Anti-upscale guard: never inflate a 480p/720p video to 1080p
        var effectiveRes = resolution
        if let videoTrack = asset.tracks(withMediaType: .video).first {
            let transformed = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
            let srcMax = max(abs(transformed.width), abs(transformed.height))
            if effectiveRes == "1080p" && srcMax > 0 && srcMax <= 1280 {
                effectiveRes = srcMax <= 640 ? "480p" : "720p"
            } else if effectiveRes == "720p" && srcMax > 0 && srcMax <= 640 {
                effectiveRes = "480p"
            }
        }

        let preset: String
        let fileType: AVFileType
        let mime: String
        switch targetFormat {
        case "m4a":
            preset = AVAssetExportPresetAppleM4A
            fileType = .m4a
            mime = "audio/mp4"
        case "m4r":
            preset = AVAssetExportPresetAppleM4A
            fileType = .m4a
            mime = "audio/x-m4r"
        case "mov":
            preset = effectiveRes == "1080p" ? AVAssetExportPreset1920x1080 : (effectiveRes == "480p" ? AVAssetExportPreset640x480 : AVAssetExportPreset1280x720)
            fileType = .mov
            mime = "video/quicktime"
        default:
            preset = effectiveRes == "1080p" ? AVAssetExportPreset1920x1080 : (effectiveRes == "480p" ? AVAssetExportPreset640x480 : AVAssetExportPreset1280x720)
            fileType = .mp4
            mime = "video/mp4"
        }

        guard let exporter = AVAssetExportSession(asset: asset, presetName: preset) else {
            call.reject("AVAssetExportSession unavailable for preset \(preset)")
            return
        }

        let workDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("job_\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: workDir, withIntermediateDirectories: true)
        let exportExt = targetFormat == "m4r" ? "m4a" : targetFormat
        let outputURL = workDir.appendingPathComponent("output.\(exportExt)")

        exporter.outputURL = outputURL
        exporter.outputFileType = fileType
        exporter.shouldOptimizeForNetworkUse = true

        if let maxDur = maxDurationSec, maxDur > 0 {
            let cap = CMTime(seconds: maxDur, preferredTimescale: 600)
            let actualDur = asset.duration
            let finalDur = CMTimeCompare(actualDur, cap) > 0 ? cap : actualDur
            exporter.timeRange = CMTimeRange(start: .zero, duration: finalDur)
        }

        exporter.exportAsynchronously {
            switch exporter.status {
            case .completed:
                if let data = try? Data(contentsOf: outputURL) {
                    defer { try? FileManager.default.removeItem(at: workDir) }
                    call.resolve([
                        "outputPath": outputURL.path,
                        "base64Data": data.base64EncodedString(),
                        "mime": mime,
                        "sizeBytes": data.count
                    ])
                } else {
                    try? FileManager.default.removeItem(at: workDir)
                    call.reject("Failed to read exported media bytes")
                }
            default:
                try? FileManager.default.removeItem(at: workDir)
                call.reject(exporter.error?.localizedDescription ?? "AVFoundation export failed")
            }
        }
    }

    /// Exports audio track from any video/audio asset to lossless 16-bit PCM WAV using AVAssetReader.
    private func exportAudioToWav(asset: AVURLAsset, call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard let audioTrack = asset.tracks(withMediaType: .audio).first else {
                call.reject("No audio track found in media file")
                return
            }
            do {
                let reader = try AVAssetReader(asset: asset)
                let outputSettings: [String: Any] = [
                    AVFormatIDKey: kAudioFormatLinearPCM,
                    AVSampleRateKey: 44100,
                    AVNumberOfChannelsKey: 2,
                    AVLinearPCMBitDepthKey: 16,
                    AVLinearPCMIsBigEndianKey: false,
                    AVLinearPCMIsFloatKey: false,
                    AVLinearPCMIsNonInterleaved: false
                ]
                let trackOutput = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: outputSettings)
                reader.add(trackOutput)
                reader.startReading()

                var pcmData = Data()
                while reader.status == .reading, let sample = trackOutput.copyNextSampleBuffer() {
                    if let block = CMSampleBufferGetDataBuffer(sample) {
                        let len = CMBlockBufferGetDataLength(block)
                        var buf = Data(count: len)
                        buf.withUnsafeMutableBytes { ptr in
                            if let base = ptr.baseAddress {
                                CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: len, destination: base)
                            }
                        }
                        pcmData.append(buf)
                    }
                }

                let wavData = self.wrapPcmAsWav(pcmData: pcmData, sampleRate: 44100, channels: 2, bitsPerSample: 16)
                call.resolve([
                    "outputPath": "",
                    "base64Data": wavData.base64EncodedString(),
                    "mime": "audio/wav",
                    "sizeBytes": wavData.count
                ])
            } catch {
                call.reject("WAV extraction failed: \(error.localizedDescription)")
            }
        }
    }

    private func wrapPcmAsWav(pcmData: Data, sampleRate: UInt32, channels: UInt16, bitsPerSample: UInt16) -> Data {
        var header = Data()
        let byteRate = sampleRate * UInt32(channels) * UInt32(bitsPerSample / 8)
        let blockAlign = channels * (bitsPerSample / 8)
        let dataSize = UInt32(pcmData.count)
        let chunkSize = 36 + dataSize

        header.append(contentsOf: "RIFF".utf8)
        header.append(withUnsafeBytes(of: chunkSize.littleEndian) { Data($0) })
        header.append(contentsOf: "WAVE".utf8)
        header.append(contentsOf: "fmt ".utf8)
        header.append(withUnsafeBytes(of: UInt32(16).littleEndian) { Data($0) })
        header.append(withUnsafeBytes(of: UInt16(1).littleEndian) { Data($0) })
        header.append(withUnsafeBytes(of: channels.littleEndian) { Data($0) })
        header.append(withUnsafeBytes(of: sampleRate.littleEndian) { Data($0) })
        header.append(withUnsafeBytes(of: byteRate.littleEndian) { Data($0) })
        header.append(withUnsafeBytes(of: blockAlign.littleEndian) { Data($0) })
        header.append(withUnsafeBytes(of: bitsPerSample.littleEndian) { Data($0) })
        header.append(contentsOf: "data".utf8)
        header.append(withUnsafeBytes(of: dataSize.littleEndian) { Data($0) })
        header.append(pcmData)
        return header
    }

    /// Tier 1 On-Device Video -> Animated GIF via AVAssetImageGenerator + Apple ImageIO
    @objc public func videoToGif(_ call: CAPPluginCall) {
        guard let inputPath = call.getString("inputPath") else {
            call.reject("Missing inputPath")
            return
        }
        let fps = max(4, min(15, call.getInt("fps") ?? 10))
        let maxDur = max(1.0, min(15.0, call.getDouble("maxDurationSec") ?? 10.0))
        let maxDim = CGFloat(max(160, min(640, call.getInt("maxDimension") ?? 480)))

        DispatchQueue.global(qos: .userInitiated).async {
            let asset = AVURLAsset(url: URL(fileURLWithPath: inputPath))
            let totalSec = min(CMTimeGetSeconds(asset.duration), maxDur)
            guard totalSec > 0 else {
                call.reject("Video duration is invalid")
                return
            }

            let frameCount = max(2, min(90, Int(totalSec * Double(fps))))
            let delay = totalSec / Double(frameCount)
            let generator = AVAssetImageGenerator(asset: asset)
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: maxDim, height: maxDim)
            generator.requestedTimeToleranceBefore = .zero
            generator.requestedTimeToleranceAfter = .zero

            let outData = NSMutableData()
            guard let dest = CGImageDestinationCreateWithData(
                outData,
                UTType.gif.identifier as CFString,
                frameCount,
                nil
            ) else {
                call.reject("Could not initialize GIF encoder")
                return
            }

            let gifProps: [CFString: Any] = [
                kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]
            ]
            CGImageDestinationSetProperties(dest, gifProps as CFDictionary)

            let frameProps: [CFString: Any] = [
                kCGImagePropertyGIFDictionary: [
                    kCGImagePropertyGIFDelayTime: delay,
                    kCGImagePropertyGIFUnclampedDelayTime: delay
                ]
            ]

            for idx in 0..<frameCount {
                let t = CMTime(seconds: Double(idx) * delay, preferredTimescale: 600)
                if let cg = try? generator.copyCGImage(at: t, actualTime: nil) {
                    CGImageDestinationAddImage(dest, cg, frameProps as CFDictionary)
                }
            }

            guard CGImageDestinationFinalize(dest) else {
                call.reject("Failed to finalize animated GIF")
                return
            }

            let bytes = outData as Data
            call.resolve([
                "base64Data": bytes.base64EncodedString(),
                "mime": "image/gif",
                "sizeBytes": bytes.count
            ])
        }
    }

    /// Zero-residual cleanup of orphan temporary job directories.
    @objc public func cleanupTempWorkspace(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .utility).async {
            let fm = FileManager.default
            let tmp = fm.temporaryDirectory
            var cleanedBytes = 0
            var removedDirs = 0

            if let items = try? fm.contentsOfDirectory(at: tmp, includingPropertiesForKeys: [.fileSizeKey]) {
                for url in items where url.lastPathComponent.hasPrefix("job_") || url.lastPathComponent.hasPrefix("omniconvert_share_") || url.lastPathComponent.hasPrefix("omniconvert_ql") {
                    if let attrs = try? fm.attributesOfItem(atPath: url.path),
                       let sz = attrs[.size] as? Int {
                        cleanedBytes += sz
                    }
                    try? fm.removeItem(at: url)
                    removedDirs += 1
                }
            }

            call.resolve([
                "cleanedBytes": cleanedBytes,
                "removedDirs": removedDirs
            ])
        }
    }

    /// Reads files handed off via iOS Open-In inbox and immediately removes them after handoff.
    @objc public func getSharedInboxFiles(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            let fm = FileManager.default
            let inboxDir = fm.temporaryDirectory.appendingPathComponent("omniconvert_inbox", isDirectory: true)
            guard let urls = try? fm.contentsOfDirectory(at: inboxDir, includingPropertiesForKeys: nil) else {
                call.resolve(["files": []])
                return
            }

            var out: [[String: Any]] = []
            for url in urls {
                defer { try? fm.removeItem(at: url) }
                guard let data = try? Data(contentsOf: url), data.count <= 25 * 1024 * 1024 else {
                    continue
                }
                let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                out.append([
                    "name": url.lastPathComponent,
                    "base64Data": data.base64EncodedString(),
                    "mime": mime
                ])
            }
            call.resolve(["files": out])
        }
    }
}

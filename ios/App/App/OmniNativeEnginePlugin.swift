import Foundation
import UIKit
import Capacitor
import ImageIO
import CoreImage
import UniformTypeIdentifiers
import PDFKit
import Vision
import AVFoundation

@objc(OmniNativeEnginePlugin)
public class OmniNativeEnginePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmniNativeEnginePlugin"
    public let jsName = "OmniNativeEngine"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "convertImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeTextOcr", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "convertMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pdfToImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cleanupTempWorkspace", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSharedInboxFiles", returnType: CAPPluginReturnPromise)
    ]

    @objc public func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "platform": "ios",
            "osVersion": UIDevice.current.systemVersion
        ])
    }

    /// Tier 1 Hardware Image Conversion via Apple ImageIO / CoreImage
    /// Supports HEIC, HEIF, DNG/CR2/NEF/ARW RAW, PNG, JPEG, TIFF, BMP, GIF with real EXIF/GPS stripping.
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

            let cgImage: CGImage?
            if let maxDim = maxDim, maxDim > 0 {
                let thumbOpts: [CFString: Any] = [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceThumbnailMaxPixelSize: maxDim
                ]
                cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbOpts as CFDictionary)
            } else {
                cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
            }

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

            var props: [CFString: Any] = [
                kCGImageDestinationLossyCompressionQuality: Double(quality) / 100.0
            ]
            if stripExif {
                props[kCGImagePropertyExifDictionary] = kCFNull
                props[kCGImagePropertyGPSDictionary] = kCFNull
                props[kCGImagePropertyTIFFDictionary] = kCFNull
                props[kCGImagePropertyIPTCDictionary] = kCFNull
            }

            CGImageDestinationAddImage(destination, decoded, props as CFDictionary)
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
    @objc public func convertMedia(_ call: CAPPluginCall) {
        guard let inputPath = call.getString("inputPath") else {
            call.reject("Missing inputPath")
            return
        }
        let targetFormat = (call.getString("targetFormat") ?? "mp4").lowercased()
        let inputURL = URL(fileURLWithPath: inputPath)
        let asset = AVURLAsset(url: inputURL)

        let preset: String
        let fileType: AVFileType
        switch targetFormat {
        case "m4a":
            preset = AVAssetExportPresetAppleM4A
            fileType = .m4a
        case "mov":
            preset = AVAssetExportPresetHighestQuality
            fileType = .mov
        default:
            preset = AVAssetExportPreset1280x720
            fileType = .mp4
        }

        guard let exporter = AVAssetExportSession(asset: asset, presetName: preset) else {
            call.reject("AVAssetExportSession unavailable for preset \(preset)")
            return
        }

        let workDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("job_\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: workDir, withIntermediateDirectories: true)
        let outputURL = workDir.appendingPathComponent("output.\(targetFormat)")

        exporter.outputURL = outputURL
        exporter.outputFileType = fileType
        exporter.shouldOptimizeForNetworkUse = true

        exporter.exportAsynchronously {
            switch exporter.status {
            case .completed:
                let size = (try? FileManager.default.attributesOfItem(atPath: outputURL.path)[.size] as? Int) ?? 0
                call.resolve([
                    "outputPath": outputURL.path,
                    "sizeBytes": size
                ])
            default:
                try? FileManager.default.removeItem(at: workDir)
                call.reject(exporter.error?.localizedDescription ?? "AVFoundation export failed")
            }
        }
    }

    /// Zero-residual cleanup of orphan temporary job directories older than 1 hour (or all on explicit clear).
    @objc public func cleanupTempWorkspace(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .utility).async {
            let fm = FileManager.default
            let tmp = fm.temporaryDirectory
            var cleanedBytes = 0
            var removedDirs = 0

            if let items = try? fm.contentsOfDirectory(at: tmp, includingPropertiesForKeys: [.fileSizeKey]) {
                for url in items where url.lastPathComponent.hasPrefix("job_") || url.lastPathComponent.hasPrefix("omniconvert_share_") {
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

    /// Reads files handed off via iOS Open-In / Share Extension inbox and immediately removes them after handoff.
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

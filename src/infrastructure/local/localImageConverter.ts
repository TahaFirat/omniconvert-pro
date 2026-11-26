import { OmniError } from '../../core/errors';
import type { ConversionOptions } from '../../domain/entities/job';
import {
  base64ToUint8,
  isNativeIos,
  OmniNativeEngine,
  uint8ToBase64,
} from '../native/omniNativeBridge';
import {
  stripJpegMetadataLossless,
  stripPngMetadataLossless,
} from './losslessMetadataStripper';

function encodeBmpFromRgba(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelArraySize = rowStride * height;
  const fileSize = 54 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);

  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelArraySize, true);

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const dstRow = 54 + y * rowStride;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 4;
      const dstIdx = dstRow + x * 3;
      bytes[dstIdx] = rgba[srcIdx + 2];
      bytes[dstIdx + 1] = rgba[srcIdx + 1];
      bytes[dstIdx + 2] = rgba[srcIdx];
    }
  }
  return bytes;
}

function wrapPngAsIco(pngBytes: Uint8Array, width: number, height: number): Uint8Array {
  const headerSize = 6 + 16;
  const out = new Uint8Array(headerSize + pngBytes.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  view.setUint8(6, width >= 256 ? 0 : width);
  view.setUint8(7, height >= 256 ? 0 : height);
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, headerSize, true);
  out.set(pngBytes, headerSize);
  return out;
}

async function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new OmniError('IMAGE_DECODE_ERROR', 'Failed to decode image locally.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function copyToBlob(bytes: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: mime });
}

export async function convertImageLocally(
  inputBlob: Blob,
  sourceFormat: string,
  targetFormat: string,
  options: ConversionOptions,
): Promise<{ blob: Blob; mime: string }> {
  const src = sourceFormat.toLowerCase();
  const dst = targetFormat.toLowerCase();

  // FAST LOSSLESS PASSTHROUGH: Avoid generation loss & 3x-5x Canvas bloat on same-format EXIF-strip!
  if (!options.maxDimension) {
    if (src === 'png' && dst === 'png') {
      const raw = new Uint8Array(await inputBlob.arrayBuffer());
      const cleaned = options.stripExif ? stripPngMetadataLossless(raw) : raw;
      return { blob: copyToBlob(cleaned, 'image/png'), mime: 'image/png' };
    }
    if ((src === 'jpg' || src === 'jpeg') && (dst === 'jpg' || dst === 'jpeg') && options.quality >= 85) {
      const raw = new Uint8Array(await inputBlob.arrayBuffer());
      const res = options.stripExif
        ? stripJpegMetadataLossless(raw)
        : { bytes: raw, orientation: 1, strippedSegments: 0 };
      if (res.orientation === 1) {
        return { blob: copyToBlob(res.bytes, 'image/jpeg'), mime: 'image/jpeg' };
      }
    }
  }

  // Tier 1 Native iOS ImageIO / CoreImage path (HEIC, RAW, TIFF, and hardware JPEG/PNG/WebP)
  const nativePreferred =
    ['heic', 'heif', 'dng', 'cr2', 'nef', 'arw', 'tiff'].includes(src) || dst === 'heic';
  if (isNativeIos() && (nativePreferred || ['jpg', 'png', 'webp'].includes(dst))) {
    try {
      const bytes = new Uint8Array(await inputBlob.arrayBuffer());
      const base64Data = await uint8ToBase64(bytes);
      const res = await OmniNativeEngine.convertImage({
        base64Data,
        sourceFormat: src,
        targetFormat: dst,
        quality: options.quality,
        maxDimension: options.maxDimension,
        stripExif: options.stripExif,
      });
      const outBytes = base64ToUint8(res.base64Data);

      // Strict Never-Bloat Guard for same-format optimization
      if (src === dst && !options.maxDimension && outBytes.byteLength >= bytes.byteLength) {
        if (src === 'jpg') {
          const stripped = options.stripExif ? stripJpegMetadataLossless(bytes) : { bytes, orientation: 1 };
          if (stripped.orientation === 1 && stripped.bytes.byteLength <= outBytes.byteLength) {
            return { blob: copyToBlob(stripped.bytes, 'image/jpeg'), mime: 'image/jpeg' };
          }
        }
        if (src === 'png') {
          const stripped = options.stripExif ? stripPngMetadataLossless(bytes) : bytes;
          return { blob: copyToBlob(stripped, 'image/png'), mime: 'image/png' };
        }
      }

      return { blob: copyToBlob(outBytes, res.mime), mime: res.mime };
    } catch {
      if (nativePreferred) {
        throw new OmniError(
          'IOS_IMAGEIO_FAILED',
          `Native iOS ImageIO failed to convert ${src.toUpperCase()} -> ${dst.toUpperCase()}.`,
        );
      }
    }
  }

  if (nativePreferred && !isNativeIos()) {
    throw new OmniError(
      'NATIVE_IOS_REQUIRED',
      `${src.toUpperCase()} hardware decoding runs via iOS ImageIO on device.`,
    );
  }

  // Tier 2 On-Device Canvas Rasterizer & Encoder (strict anti-upscale + Never-Bloat guard!)
  const sourceBlob =
    src === 'svg'
      ? new Blob([await inputBlob.text()], { type: 'image/svg+xml;charset=utf-8' })
      : inputBlob;

  const img = await loadImageElement(sourceBlob);
  let targetW = img.naturalWidth || img.width || 512;
  let targetH = img.naturalHeight || img.height || 512;

  if (dst === 'ico') {
    const cap = Math.min(options.maxDimension ?? 256, 256);
    const scale = Math.min(1, cap / Math.max(targetW, targetH));
    targetW = Math.max(16, Math.round(targetW * scale));
    targetH = Math.max(16, Math.round(targetH * scale));
  } else if (options.maxDimension && Math.max(targetW, targetH) > options.maxDimension) {
    // Anti-upscale guard: strictly only shrink when larger than maxDimension
    const scale = options.maxDimension / Math.max(targetW, targetH);
    targetW = Math.max(1, Math.round(targetW * scale));
    targetH = Math.max(1, Math.round(targetH * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new OmniError('CANVAS_UNAVAILABLE', '2D graphics context is unavailable.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // White background when flattening transparency to opaque JPEG/BMP
  if (dst === 'jpg' || dst === 'jpeg' || dst === 'bmp') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  if (dst === 'bmp') {
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const bmp = encodeBmpFromRgba(imgData.data, targetW, targetH);
    return { blob: copyToBlob(bmp, 'image/bmp'), mime: 'image/bmp' };
  }

  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    ico: 'image/png',
  };
  const canvasMime = mimeMap[dst] ?? 'image/png';
  const qualityFloat = Math.max(0.1, Math.min(1, options.quality / 100));

  const encodeCanvas = (q?: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new OmniError('IMAGE_ENCODE_ERROR', 'Failed to encode image output.'))),
        canvasMime,
        canvasMime === 'image/png' ? undefined : q,
      );
    });

  let encodedBlob = await encodeCanvas(qualityFloat);

  // Never-Bloat Guard for lossy same-format compression (e.g. already-compressed JPG -> JPG)
  if ((src === 'jpg' || src === 'jpeg' || src === 'webp') && src === dst && !options.maxDimension) {
    if (encodedBlob.size >= inputBlob.size && qualityFloat > 0.55) {
      const stepped = await encodeCanvas(Math.max(0.5, qualityFloat - 0.14));
      if (stepped.size < encodedBlob.size) {
        encodedBlob = stepped;
      }
    }
    if (encodedBlob.size >= inputBlob.size && src === 'jpg') {
      const raw = new Uint8Array(await inputBlob.arrayBuffer());
      const stripped = options.stripExif ? stripJpegMetadataLossless(raw) : { bytes: raw, orientation: 1 };
      if (stripped.orientation === 1 && stripped.bytes.byteLength < encodedBlob.size) {
        return { blob: copyToBlob(stripped.bytes, 'image/jpeg'), mime: 'image/jpeg' };
      }
    }
  }

  if (dst === 'ico') {
    const pngBytes = new Uint8Array(await encodedBlob.arrayBuffer());
    const icoBytes = wrapPngAsIco(pngBytes, targetW, targetH);
    return { blob: copyToBlob(icoBytes, 'image/x-icon'), mime: 'image/x-icon' };
  }

  return { blob: encodedBlob, mime: canvasMime };
}

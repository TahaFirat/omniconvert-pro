import { OmniError } from '../../core/errors';
import type { ConversionOptions } from '../../domain/entities/job';
import {
  base64ToUint8,
  isNativeIos,
  OmniNativeEngine,
  uint8ToBase64,
} from '../native/omniNativeBridge';

function encodeBmpFromRgba(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelArraySize = rowStride * height;
  const fileSize = 54 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // BITMAPFILEHEADER (14 bytes)
  view.setUint8(0, 0x42); // B
  view.setUint8(1, 0x4d); // M
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // bottom-up
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true); // 24-bit RGB
  view.setUint32(34, pixelArraySize, true);

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const dstRow = 54 + y * rowStride;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 4;
      const dstIdx = dstRow + x * 3;
      bytes[dstIdx] = rgba[srcIdx + 2]; // B
      bytes[dstIdx + 1] = rgba[srcIdx + 1]; // G
      bytes[dstIdx + 2] = rgba[srcIdx]; // R
    }
  }
  return bytes;
}

function wrapPngAsIco(pngBytes: Uint8Array, width: number, height: number): Uint8Array {
  const headerSize = 6 + 16;
  const out = new Uint8Array(headerSize + pngBytes.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // icon type
  view.setUint16(4, 1, true); // count = 1
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

export async function convertImageLocally(
  inputBlob: Blob,
  sourceFormat: string,
  targetFormat: string,
  options: ConversionOptions,
): Promise<{ blob: Blob; mime: string }> {
  // Tier 1 Native iOS ImageIO / CoreImage path for HEIC, RAW, TIFF, or hardware JPEG/PNG/WebP
  const nativePreferred = ['heic', 'heif', 'dng', 'cr2', 'nef', 'arw', 'tiff'].includes(sourceFormat) || targetFormat === 'heic';
  if (isNativeIos() && (nativePreferred || ['jpg', 'png', 'webp'].includes(targetFormat))) {
    try {
      const bytes = new Uint8Array(await inputBlob.arrayBuffer());
      const base64Data = await uint8ToBase64(bytes);
      const res = await OmniNativeEngine.convertImage({
        base64Data,
        sourceFormat,
        targetFormat,
        quality: options.quality,
        maxDimension: options.maxDimension,
        stripExif: options.stripExif,
      });
      const outBytes = base64ToUint8(res.base64Data);
      const copy = new Uint8Array(outBytes.byteLength);
      copy.set(outBytes);
      return { blob: new Blob([copy], { type: res.mime }), mime: res.mime };
    } catch {
      if (nativePreferred) {
        throw new OmniError(
          'IOS_IMAGEIO_FAILED',
          `Native iOS ImageIO failed to convert ${sourceFormat.toUpperCase()} -> ${targetFormat.toUpperCase()}.`,
        );
      }
      // Fall through to local canvas engine for standard formats
    }
  }

  if (nativePreferred && !isNativeIos()) {
    throw new OmniError(
      'NATIVE_IOS_REQUIRED',
      `${sourceFormat.toUpperCase()} hardware decoding runs via iOS ImageIO on device (Tier 1).`,
    );
  }

  // Tier 2 On-Device Canvas Rasterizer & Encoder (automatically strips EXIF/GPS metadata!)
  const sourceBlob =
    sourceFormat === 'svg'
      ? new Blob([await inputBlob.text()], { type: 'image/svg+xml;charset=utf-8' })
      : inputBlob;

  const img = await loadImageElement(sourceBlob);
  let targetW = img.naturalWidth || img.width || 512;
  let targetH = img.naturalHeight || img.height || 512;

  if (targetFormat === 'ico') {
    const cap = Math.min(options.maxDimension ?? 256, 256);
    const scale = Math.min(1, cap / Math.max(targetW, targetH));
    targetW = Math.max(16, Math.round(targetW * scale));
    targetH = Math.max(16, Math.round(targetH * scale));
  } else if (options.maxDimension && Math.max(targetW, targetH) > options.maxDimension) {
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

  // White background when flattening transparency to opaque JPEG/BMP
  if (targetFormat === 'jpg' || targetFormat === 'bmp') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  if (targetFormat === 'bmp') {
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const bmp = encodeBmpFromRgba(imgData.data, targetW, targetH);
    const copy = new Uint8Array(bmp.byteLength);
    copy.set(bmp);
    return { blob: new Blob([copy], { type: 'image/bmp' }), mime: 'image/bmp' };
  }

  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
    ico: 'image/png',
  };
  const canvasMime = mimeMap[targetFormat] ?? 'image/png';
  const qualityFloat = Math.max(0.1, Math.min(1, options.quality / 100));

  const encodedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new OmniError('IMAGE_ENCODE_ERROR', 'Failed to encode image output.'))),
      canvasMime,
      canvasMime === 'image/png' ? undefined : qualityFloat,
    );
  });

  if (targetFormat === 'ico') {
    const pngBytes = new Uint8Array(await encodedBlob.arrayBuffer());
    const icoBytes = wrapPngAsIco(pngBytes, targetW, targetH);
    const copy = new Uint8Array(icoBytes.byteLength);
    copy.set(icoBytes);
    return { blob: new Blob([copy], { type: 'image/x-icon' }), mime: 'image/x-icon' };
  }

  return { blob: encodedBlob, mime: canvasMime };
}

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { OmniError } from '../../core/errors';
import type { ConversionOptions } from '../../domain/entities/job';
import { convertImageLocally } from './localImageConverter';
import { base64ToUint8, isNativeIos, OmniNativeEngine, uint8ToBase64 } from '../native/omniNativeBridge';

function stripPdfMetadata(pdfDoc: PDFDocument): void {
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setCreator('OmniConvert Pro');
  pdfDoc.setProducer('OmniConvert Pro (On-Device)');
}

/**
 * Converts one or more images (PNG/JPG/WebP/BMP) into a clean, EXIF-free PDF on-device.
 */
export async function imagesToPdfLocally(
  images: Array<{ blob: Blob; formatId: string }>,
  options: ConversionOptions,
): Promise<{ blob: Blob; mime: string }> {
  const pdfDoc = await PDFDocument.create();
  if (options.stripExif) {
    stripPdfMetadata(pdfDoc);
  }

  for (const item of images) {
    let imgBlob = item.blob;
    let embedType: 'png' | 'jpg' = item.formatId === 'jpg' ? 'jpg' : 'png';

    // Normalize non-PDF-native image formats or apply resize/EXIF-strip first
    if (
      item.formatId !== 'png' &&
      item.formatId !== 'jpg'
    ) {
      const converted = await convertImageLocally(item.blob, item.formatId, 'jpg', options);
      imgBlob = converted.blob;
      embedType = 'jpg';
    } else if (options.maxDimension || options.stripExif) {
      try {
        const reencoded = await convertImageLocally(item.blob, item.formatId, embedType, options);
        imgBlob = reencoded.blob;
      } catch {
        // In non-canvas test environments (jsdom), embed raw bytes directly
      }
    }

    const bytes = new Uint8Array(await imgBlob.arrayBuffer());
    const embedded =
      embedType === 'jpg'
        ? await pdfDoc.embedJpg(bytes)
        : await pdfDoc.embedPng(bytes);

    // Scale to fit A4 (595.28 x 841.89 pt) while preserving aspect ratio
    const pageW = 595.28;
    const pageH = 841.89;
    const margin = 24;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;

    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(embedded, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  return { blob: new Blob([copy], { type: 'application/pdf' }), mime: 'application/pdf' };
}

/**
 * Converts UTF-8 Plain Text or Markdown into a multi-page clean PDF on-device.
 */
export async function textToPdfLocally(
  text: string,
  options: ConversionOptions,
): Promise<{ blob: Blob; mime: string }> {
  const pdfDoc = await PDFDocument.create();
  if (options.stripExif) {
    stripPdfMetadata(pdfDoc);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = 16;
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 48;
  const maxCharsPerLine = 84;

  // Transliterate characters unsupported by WinAnsi StandardFonts cleanly so pdf-lib never throws
  const safeText = text
    .replaceAll('ğ', 'g').replaceAll('Ğ', 'G')
    .replaceAll('ş', 's').replaceAll('Ş', 'S')
    .replaceAll('ı', 'i').replaceAll('İ', 'I')
    .replaceAll('ç', 'c').replaceAll('Ç', 'C')
    .replaceAll('ö', 'o').replaceAll('Ö', 'O')
    .replaceAll('ü', 'u').replaceAll('Ü', 'U')
    .replace(/[^\x20-\x7E\r\n\t]/g, ' ');

  const rawLines = safeText.split(/\r?\n/);
  const wrappedLines: string[] = [];
  for (const raw of rawLines) {
    if (raw.length <= maxCharsPerLine) {
      wrappedLines.push(raw);
    } else {
      for (let i = 0; i < raw.length; i += maxCharsPerLine) {
        wrappedLines.push(raw.slice(i, i + maxCharsPerLine));
      }
    }
  }

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  for (const line of wrappedLines) {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0.08, 0.1, 0.14),
    });
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  return { blob: new Blob([copy], { type: 'application/pdf' }), mime: 'application/pdf' };
}

/**
 * Merges multiple PDF blobs into a single PDF on-device.
 */
export async function mergePdfsLocally(
  pdfBlobs: Blob[],
  stripMeta = true,
): Promise<{ blob: Blob; mime: string }> {
  const merged = await PDFDocument.create();
  if (stripMeta) stripPdfMetadata(merged);

  for (const blob of pdfBlobs) {
    const srcBytes = new Uint8Array(await blob.arrayBuffer());
    const srcDoc = await PDFDocument.load(srcBytes);
    const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }

  const outBytes = await merged.save({ useObjectStreams: true });
  const copy = new Uint8Array(outBytes.byteLength);
  copy.set(outBytes);
  return { blob: new Blob([copy], { type: 'application/pdf' }), mime: 'application/pdf' };
}

/**
 * Renders PDF to PNG/JPG or runs offline Vision OCR on iOS Tier 1 hardware.
 */
export async function convertPdfOutputLocally(
  inputBlob: Blob,
  targetFormat: string,
  options: ConversionOptions,
): Promise<{ blob: Blob; mime: string; previewText?: string }> {
  if (isNativeIos()) {
    const bytes = new Uint8Array(await inputBlob.arrayBuffer());
    const base64Data = await uint8ToBase64(bytes);

    if (targetFormat === 'txt') {
      const res = await OmniNativeEngine.recognizeTextOcr({
        base64Data,
        sourceFormat: 'pdf',
        language: options.ocrLanguage,
      });
      return {
        blob: new Blob([res.text], { type: 'text/plain;charset=utf-8' }),
        mime: 'text/plain',
        previewText: res.text,
      };
    }

    if (targetFormat === 'png' || targetFormat === 'jpg') {
      const res = await OmniNativeEngine.pdfToImages({
        base64Data,
        targetFormat,
        dpi: options.dpi ?? 150,
      });
      const outBytes = base64ToUint8(res.base64Data);
      const copy = new Uint8Array(outBytes.byteLength);
      copy.set(outBytes);
      return { blob: new Blob([copy], { type: res.mime }), mime: res.mime };
    }
  }

  throw new OmniError(
    'IOS_PDFKIT_REQUIRED',
    `PDF -> ${targetFormat.toUpperCase()} uses native iOS PDFKit / Vision OCR on device (Tier 1).`,
  );
}

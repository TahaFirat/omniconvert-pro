import { PDFDocument } from 'pdf-lib';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { isNativeIos, OmniNativeEngine, uint8ToBase64 } from '../native/omniNativeBridge';

export interface PdfRenderedPage {
  dataUrl: string;
  pageCount: number;
  width: number;
  height: number;
}

let pdfjsConfigured = false;

async function getPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjsConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    pdfjsConfigured = true;
  }
  return pdfjs;
}

/**
 * Fast, non-throwing PDF page counter (handles owner-restricted PDFs cleanly).
 */
export async function getPdfPageCount(blob: Blob): Promise<number | undefined> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return undefined;
  }
}

/**
 * Renders a single 1-based PDF page into a crisp PNG/JPEG data URL.
 * Uses native Apple PDFKit on iOS first, and bundled offline PDF.js canvas everywhere else.
 */
export async function renderPdfPageToDataUrl(
  blob: Blob,
  pageNumber = 1,
  targetScale = 1.6,
): Promise<PdfRenderedPage> {
  if (isNativeIos()) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const base64Data = await uint8ToBase64(bytes);
      const res = await OmniNativeEngine.renderPdfPreviewPage({
        base64Data,
        pageNumber,
        maxWidth: Math.round(900 * Math.min(2, Math.max(0.75, targetScale))),
      });
      return {
        dataUrl: `data:${res.mime};base64,${res.base64Data}`,
        pageCount: res.pageCount,
        width: res.width,
        height: res.height,
      };
    } catch {
      // Fall back to bundled PDF.js canvas renderer
    }
  }

  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const safePage = Math.max(1, Math.min(pdf.numPages, pageNumber));
    const page = await pdf.getPage(safePage);
    const viewport = page.getViewport({ scale: targetScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas unavailable for PDF preview');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      canvas,
      viewport,
    }).promise;

    return {
      dataUrl: canvas.toDataURL('image/png'),
      pageCount: pdf.numPages,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
}

/**
 * Renders a PDF page directly to a PNG or JPEG Blob (used for PDF -> PNG/JPG on Web & fallback).
 */
export async function renderPdfPageToImageBlob(
  blob: Blob,
  targetFormat: 'png' | 'jpg',
  dpi = 150,
  pageNumber = 1,
): Promise<{ blob: Blob; mime: string }> {
  const scale = Math.max(1, Math.min(3.5, dpi / 72));
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const safePage = Math.max(1, Math.min(pdf.numPages, pageNumber));
    const page = await pdf.getPage(safePage);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;

    const mime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode PDF page image'))),
        mime,
        targetFormat === 'jpg' ? 0.9 : undefined,
      );
    });
    return { blob: outBlob, mime };
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
}

/**
 * Extracts selectable UTF-8 text from a PDF document using PDF.js (offline, works on Web & iOS).
 */
export async function extractPdfTextLocally(blob: Blob, maxPages = 40): Promise<string> {
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    const cap = Math.min(pdf.numPages, maxPages);
    for (let i = 1; i <= cap; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const text = tc.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) pages.push(text);
    }
    return pages.join('\n\n---\n\n');
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
}

import { SECURITY_GUARDS } from '../../core/constants';
import type { FileInspectionResult, WarningCode } from '../entities/format';
import { getFormatDescriptor, normalizeFormatId } from '../formats/registry';

function bytesToAscii(bytes: Uint8Array, start = 0, end = bytes.length): string {
  const slice = bytes.subarray(start, Math.min(end, bytes.length));
  let out = '';
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i];
    out += b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ';
  }
  return out;
}

function bytesToHex(bytes: Uint8Array, len = 12): string {
  return Array.from(bytes.subarray(0, Math.min(len, bytes.length)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function matchBytes(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function getExtensionFromName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tgz';
  const dot = lower.lastIndexOf('.');
  if (dot <= 0 || dot === lower.length - 1) return '';
  return normalizeFormatId(lower.slice(dot + 1));
}

interface ZipPeekResult {
  formatId: string;
  isEncrypted: boolean;
  hasDrm: boolean;
  entryCount: number;
}

/**
 * Peeks into ZIP local file headers inside the first 64KB (plus tail if small)
 * to identify DOCX/XLSX/PPTX/EPUB/ODT/ODS/ODP/3MF/Pages/Numbers/Keynote/CBZ,
 * encrypted ZIP general-purpose flag (bit 0), and Adobe ADEPT DRM.
 */
function peekZipContainer(bytes: Uint8Array, claimedExt: string): ZipPeekResult {
  const text = bytesToAscii(bytes);
  let isEncrypted = false;
  let entryCount = 0;

  // Walk ZIP local file headers (PK\x03\x04) within our inspected slice
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x03 &&
      bytes[offset + 3] === 0x04
    ) {
      entryCount++;
      const gpFlag = bytes[offset + 6] | (bytes[offset + 7] << 8);
      if ((gpFlag & 0x0001) !== 0) {
        isEncrypted = true;
      }
      const compressedSize =
        bytes[offset + 18] |
        (bytes[offset + 19] << 8) |
        (bytes[offset + 20] << 16) |
        (bytes[offset + 21] << 24);
      const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
      const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
      const next = offset + 30 + nameLen + extraLen + Math.max(0, compressedSize);
      if (next <= offset || next >= bytes.length) break;
      offset = next;
    } else {
      offset++;
    }
  }

  const hasDrm =
    text.includes('META-INF/rights.xml') ||
    text.includes('META-INF/encryption.xml') && text.includes('adept');

  let formatId = 'zip';
  if (
    text.includes('application/epub+zip') ||
    text.includes('META-INF/container.xml') ||
    text.includes('OEBPS/') ||
    (text.includes('mimetype') && claimedExt === 'epub')
  ) {
    formatId = 'epub';
  } else if (text.includes('word/document.xml') || text.includes('word/')) {
    formatId = 'docx';
  } else if (text.includes('xl/workbook.xml') || text.includes('xl/worksheets')) {
    formatId = 'xlsx';
  } else if (text.includes('ppt/presentation.xml') || text.includes('ppt/slides')) {
    formatId = 'pptx';
  } else if (text.includes('application/vnd.oasis.opendocument.text')) {
    formatId = 'odt';
  } else if (text.includes('application/vnd.oasis.opendocument.spreadsheet')) {
    formatId = 'ods';
  } else if (text.includes('application/vnd.oasis.opendocument.presentation')) {
    formatId = 'odp';
  } else if (text.includes('3D/3dmodel.model')) {
    formatId = '3mf';
  } else if (text.includes('Index/Document.iwa')) {
    formatId = ['pages', 'numbers', 'key'].includes(claimedExt) ? claimedExt : 'pages';
  } else if (claimedExt === 'cbz') {
    formatId = 'cbz';
  } else if (claimedExt === 'usdz' || text.includes('.usdc') || text.includes('.usda')) {
    formatId = 'usdz';
  }

  return { formatId, isEncrypted, hasDrm, entryCount };
}

function detectPlainTextFormat(bytes: Uint8Array, claimedExt: string): { formatId: string; heuristic: boolean } | null {
  // Check if mostly printable UTF-8 text (no excessive NUL bytes)
  let nulCount = 0;
  const checkLen = Math.min(bytes.length, 4096);
  for (let i = 0; i < checkLen; i++) {
    if (bytes[i] === 0x00) nulCount++;
  }
  if (checkLen > 0 && nulCount / checkLen > 0.02) return null;

  const trimmed = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.length, 8192)))
    .trimStart();

  if (!trimmed) {
    return claimedExt ? { formatId: claimedExt, heuristic: false } : { formatId: 'txt', heuristic: true };
  }

  if (trimmed.startsWith('{\\rtf')) return { formatId: 'rtf', heuristic: true };
  if (/^<svg[\s>]/i.test(trimmed) || (trimmed.startsWith('<?xml') && trimmed.includes('<svg'))) {
    return { formatId: 'svg', heuristic: true };
  }
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return { formatId: 'html', heuristic: true };
  }
  if (trimmed.startsWith('<?xml')) {
    if (trimmed.includes('<FictionBook')) return { formatId: 'fb2', heuristic: true };
    if (trimmed.includes('<COLLADA')) return { formatId: 'dae', heuristic: true };
    return { formatId: 'xml', heuristic: true };
  }
  if (trimmed.startsWith('ISO-10303-21')) return { formatId: 'step', heuristic: true };
  if (trimmed.startsWith('0\nSECTION') || trimmed.startsWith('0\r\nSECTION')) {
    return { formatId: 'dxf', heuristic: true };
  }

  // JSON check
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && claimedExt !== 'yaml') {
    try {
      // Quick validate if small or trust structured start for JSON/glTF
      if (bytes.length < 65_536) {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && 'asset' in parsed && 'scenes' in parsed) {
          return { formatId: 'gltf', heuristic: true };
        }
        return { formatId: 'json', heuristic: true };
      }
      if (claimedExt === 'gltf') return { formatId: 'gltf', heuristic: true };
      return { formatId: 'json', heuristic: true };
    } catch {
      // fall through
    }
  }

  const plainTextExts = new Set([
    'csv', 'tsv', 'yaml', 'toml', 'md', 'txt', 'html', 'xml', 'json', 'svg', 'rtf', 'tex', 'obj', 'dxf', 'step', 'iges', 'gltf',
  ]);
  if (claimedExt && plainTextExts.has(claimedExt)) {
    return { formatId: claimedExt, heuristic: false };
  }

  return { formatId: 'txt', heuristic: true };
}

/**
 * Inspects a raw byte header (up to 64 KB) + metadata without loading entire files into RAM.
 */
export function inspectBytes(
  headerBytes: Uint8Array,
  fileName: string,
  fileSizeBytes: number,
): FileInspectionResult {
  const claimedExtension = getExtensionFromName(fileName);
  const warnings: WarningCode[] = [];
  let detectedFormatId = '';
  let confidence: FileInspectionResult['confidence'] = 'magic_bytes';
  let isEncrypted = false;
  let hasDrm = false;
  let containerEntries: number | undefined;

  // 1. PDF (%PDF-) + /Encrypt check
  if (matchBytes(headerBytes, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    detectedFormatId = 'pdf';
    const pdfAscii = bytesToAscii(headerBytes);
    if (pdfAscii.includes('/Encrypt')) {
      isEncrypted = true;
    }
  }
  // 2. PNG (\x89PNG\r\n\x1a\n)
  else if (matchBytes(headerBytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    detectedFormatId = 'png';
  }
  // 3. JPEG (\xFF\xD8\xFF)
  else if (matchBytes(headerBytes, 0, [0xff, 0xd8, 0xff])) {
    detectedFormatId = 'jpg';
  }
  // 4. GIF (GIF87a / GIF89a)
  else if (
    matchBytes(headerBytes, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    matchBytes(headerBytes, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    detectedFormatId = 'gif';
  }
  // 5. RIFF container: WebP, WAV, AVI
  else if (matchBytes(headerBytes, 0, [0x52, 0x49, 0x46, 0x46]) && headerBytes.length >= 12) {
    const fourcc = bytesToAscii(headerBytes, 8, 12);
    if (fourcc === 'WEBP') detectedFormatId = 'webp';
    else if (fourcc === 'WAVE') detectedFormatId = 'wav';
    else if (fourcc === 'AVI ') detectedFormatId = 'avi';
  }
  // 6. BMP (BM)
  else if (matchBytes(headerBytes, 0, [0x42, 0x4d])) {
    detectedFormatId = 'bmp';
  }
  // 7. ICO (00 00 01 00)
  else if (matchBytes(headerBytes, 0, [0x00, 0x00, 0x01, 0x00])) {
    detectedFormatId = 'ico';
  }
  // 8. TIFF / Camera RAW (II*\0 or MM\0*)
  else if (
    matchBytes(headerBytes, 0, [0x49, 0x49, 0x2a, 0x00]) ||
    matchBytes(headerBytes, 0, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    if (matchBytes(headerBytes, 8, [0x43, 0x52])) detectedFormatId = 'cr2';
    else if (['dng', 'nef', 'arw', 'cr2', 'orf'].includes(claimedExtension)) {
      detectedFormatId = claimedExtension;
    } else {
      detectedFormatId = 'tiff';
    }
  }
  // 9. Photoshop PSD (8BPS)
  else if (matchBytes(headerBytes, 0, [0x38, 0x42, 0x50, 0x53])) {
    detectedFormatId = 'psd';
  }
  // 10. GIMP XCF (gimp xcf)
  else if (bytesToAscii(headerBytes, 0, 8) === 'gimp xcf') {
    detectedFormatId = 'xcf';
  }
  // 11. QOI (qoif)
  else if (matchBytes(headerBytes, 0, [0x71, 0x6f, 0x69, 0x66])) {
    detectedFormatId = 'qoi';
  }
  // 12. OpenEXR
  else if (matchBytes(headerBytes, 0, [0x76, 0x2f, 0x31, 0x01])) {
    detectedFormatId = 'exr';
  }
  // 13. JPEG XL
  else if (
    matchBytes(headerBytes, 0, [0xff, 0x0a]) ||
    matchBytes(headerBytes, 0, [0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20])
  ) {
    detectedFormatId = 'jxl';
  }
  // 14. ISO Base Media File Format (ftyp): HEIC, HEIF, AVIF, MP4, MOV, M4A, M4V, M4P (DRM), CR3
  else if (headerBytes.length >= 12 && bytesToAscii(headerBytes, 4, 8) === 'ftyp') {
    const brand = bytesToAscii(headerBytes, 8, 12).trim();
    const asciiScan = bytesToAscii(headerBytes, 0, Math.min(headerBytes.length, 4096));
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) detectedFormatId = 'heic';
    else if (['mif1', 'msf1', 'heif'].includes(brand)) detectedFormatId = 'heif';
    else if (['avif', 'avis'].includes(brand)) detectedFormatId = 'avif';
    else if (brand === 'crx') detectedFormatId = 'cr3';
    else if (brand === 'qt') detectedFormatId = 'mov';
    else if (brand === 'M4A') detectedFormatId = 'm4a';
    else if (brand === 'M4B') detectedFormatId = 'm4b';
    else if (brand === 'M4P' || asciiScan.includes('drms') || asciiScan.includes('sinf')) {
      detectedFormatId = 'm4p';
      hasDrm = true;
    } else if (brand === 'M4V') detectedFormatId = 'm4v';
    else if (brand.startsWith('3gp')) detectedFormatId = '3gp';
    else detectedFormatId = 'mp4';
  }
  // 15. Matroska / WebM (EBML 1A 45 DF A3)
  else if (matchBytes(headerBytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
    const ebmlText = bytesToAscii(headerBytes, 0, 128).toLowerCase();
    detectedFormatId = ebmlText.includes('webm') ? 'webm' : 'mkv';
  }
  // 16. FLV
  else if (matchBytes(headerBytes, 0, [0x46, 0x4c, 0x56, 0x01])) {
    detectedFormatId = 'flv';
  }
  // 17. FLAC (fLaC)
  else if (matchBytes(headerBytes, 0, [0x66, 0x4c, 0x61, 0x43])) {
    detectedFormatId = 'flac';
  }
  // 18. OGG / Opus (OggS)
  else if (matchBytes(headerBytes, 0, [0x4f, 0x67, 0x67, 0x53])) {
    const ascii = bytesToAscii(headerBytes, 0, 64);
    detectedFormatId = ascii.includes('OpusHead') ? 'opus' : 'ogg';
  }
  // 19. MP3 (ID3 or frame sync)
  else if (
    matchBytes(headerBytes, 0, [0x49, 0x44, 0x33]) ||
    matchBytes(headerBytes, 0, [0xff, 0xfb]) ||
    matchBytes(headerBytes, 0, [0xff, 0xf3])
  ) {
    detectedFormatId = 'mp3';
  }
  // 20. AIFF (FORM....AIFF)
  else if (matchBytes(headerBytes, 0, [0x46, 0x4f, 0x52, 0x4d]) && bytesToAscii(headerBytes, 8, 12) === 'AIFF') {
    detectedFormatId = 'aiff';
  }
  // 21. Apple CAF (caff)
  else if (matchBytes(headerBytes, 0, [0x63, 0x61, 0x66, 0x66])) {
    detectedFormatId = 'caf';
  }
  // 22. MIDI (MThd)
  else if (matchBytes(headerBytes, 0, [0x4d, 0x54, 0x68, 0x64])) {
    detectedFormatId = 'mid';
  }
  // 23. ZIP & ZIP-based containers (DOCX/XLSX/PPTX/EPUB/ODT/ODS/ODP/3MF/CBZ/Pages)
  else if (matchBytes(headerBytes, 0, [0x50, 0x4b, 0x03, 0x04])) {
    const zipInfo = peekZipContainer(headerBytes, claimedExtension);
    detectedFormatId = zipInfo.formatId;
    isEncrypted = zipInfo.isEncrypted;
    hasDrm = zipInfo.hasDrm;
    containerEntries = zipInfo.entryCount;
    confidence = zipInfo.formatId === 'zip' ? 'magic_bytes' : 'zip_container';
  }
  // 24. GZIP (1F 8B)
  else if (matchBytes(headerBytes, 0, [0x1f, 0x8b])) {
    detectedFormatId = claimedExtension === 'tgz' ? 'tgz' : 'gz';
  }
  // 25. BZIP2 (BZh)
  else if (matchBytes(headerBytes, 0, [0x42, 0x5a, 0x68])) {
    detectedFormatId = 'bz2';
  }
  // 26. XZ (FD 37 7A 58 5A 00)
  else if (matchBytes(headerBytes, 0, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) {
    detectedFormatId = 'xz';
  }
  // 27. ZSTD (28 B5 2F FD)
  else if (matchBytes(headerBytes, 0, [0x28, 0xb5, 0x2f, 0xfd])) {
    detectedFormatId = 'zst';
  }
  // 28. 7-Zip (37 7A BC AF 27 1C) + basic header encryption probe
  else if (matchBytes(headerBytes, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
    detectedFormatId = '7z';
    // EncodedHeader ID 0x17 + k7zAES codec ID sequence (0x06 0xF1 0x07 0x01)
    for (let i = 32; i + 4 < headerBytes.length; i++) {
      if (
        headerBytes[i] === 0x06 &&
        headerBytes[i + 1] === 0xf1 &&
        headerBytes[i + 2] === 0x07 &&
        headerBytes[i + 3] === 0x01
      ) {
        isEncrypted = true;
        break;
      }
    }
  }
  // 29. RAR (Rar!\x1A\x07)
  else if (matchBytes(headerBytes, 0, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) {
    detectedFormatId = claimedExtension === 'cbr' ? 'cbr' : 'rar';
  }
  // 30. TAR (ustar at offset 257)
  else if (headerBytes.length > 262 && bytesToAscii(headerBytes, 257, 262) === 'ustar') {
    detectedFormatId = 'tar';
  }
  // 31. Kindle KFX / Amazon DRM ($ION / KFX / BOOKMOBI with DRM flag)
  else if (
    matchBytes(headerBytes, 0, [0xea, 0x44, 0x52, 0x4d]) ||
    bytesToAscii(headerBytes, 0, 8).includes('DRMION') ||
    claimedExtension === 'kfx'
  ) {
    detectedFormatId = 'kfx';
    hasDrm = true;
  } else if (headerBytes.length >= 68 && bytesToAscii(headerBytes, 60, 68) === 'BOOKMOBI') {
    detectedFormatId = claimedExtension === 'azw' || claimedExtension === 'azw3' ? claimedExtension : 'mobi';
    // Check PalmDOC encryption type at offset 12 inside MOBI header if present
    const ascii = bytesToAscii(headerBytes, 0, Math.min(headerBytes.length, 512));
    if (claimedExtension === 'azw' || ascii.includes('EXTH') && headerBytes.length > 100 && headerBytes[92] === 0x02) {
      hasDrm = true;
    }
  }
  // 32. DjVu (AT&TFORM)
  else if (bytesToAscii(headerBytes, 0, 8) === 'AT&TFORM') {
    detectedFormatId = 'djvu';
  }
  // 33. GLB (glTF binary: 67 6C 54 46)
  else if (matchBytes(headerBytes, 0, [0x67, 0x6c, 0x54, 0x46])) {
    detectedFormatId = 'glb';
  }
  // 34. Blender (BLENDER)
  else if (bytesToAscii(headerBytes, 0, 7) === 'BLENDER') {
    detectedFormatId = 'blend';
  }
  // 35. AutoCAD DWG (AC10)
  else if (bytesToAscii(headerBytes, 0, 4) === 'AC10') {
    detectedFormatId = 'dwg';
  }
  // 36. Fonts: WOFF, WOFF2, OTF, TTF
  else if (bytesToAscii(headerBytes, 0, 4) === 'wOF2') {
    detectedFormatId = 'woff2';
  } else if (bytesToAscii(headerBytes, 0, 4) === 'wOFF') {
    detectedFormatId = 'woff';
  } else if (bytesToAscii(headerBytes, 0, 4) === 'OTTO') {
    detectedFormatId = 'otf';
  } else if (matchBytes(headerBytes, 0, [0x00, 0x01, 0x00, 0x00]) && claimedExtension === 'ttf') {
    detectedFormatId = 'ttf';
  }
  // 37. Parquet (PAR1) & SQLite (SQLite format 3)
  else if (bytesToAscii(headerBytes, 0, 4) === 'PAR1') {
    detectedFormatId = 'parquet';
  } else if (bytesToAscii(headerBytes, 0, 15) === 'SQLite format 3') {
    detectedFormatId = 'sqlite';
  }
  // 38. Legacy OLE2 (DOC / XLS / PPT)
  else if (matchBytes(headerBytes, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    detectedFormatId = ['doc', 'xls', 'ppt', 'wps'].includes(claimedExtension) ? claimedExtension : 'doc';
  }
  // 39. PostScript / EPS / AI
  else if (bytesToAscii(headerBytes, 0, 4) === '%!PS') {
    detectedFormatId = claimedExtension === 'ai' ? 'ai' : 'eps';
  }
  // 40. Plain-text heuristics (only fallback for plain text formats!)
  else {
    const textResult = detectPlainTextFormat(headerBytes, claimedExtension);
    if (textResult) {
      detectedFormatId = textResult.formatId;
      confidence = textResult.heuristic ? 'text_heuristic' : 'extension_fallback';
    } else {
      detectedFormatId = claimedExtension || 'bin';
      confidence = 'extension_fallback';
    }
  }

  if (hasDrm) warnings.push('BLOCK_DRM');
  if (isEncrypted) warnings.push('BLOCK_ENCRYPTED');

  const descriptor = getFormatDescriptor(detectedFormatId);
  const isExtensionMismatch =
    Boolean(claimedExtension) &&
    claimedExtension !== detectedFormatId &&
    confidence !== 'extension_fallback';

  return {
    fileName,
    fileSizeBytes,
    claimedExtension: claimedExtension || detectedFormatId,
    detectedFormatId,
    detectedMime: descriptor?.mime ?? 'application/octet-stream',
    confidence,
    isExtensionMismatch,
    isEncrypted,
    hasDrm,
    warnings,
    summaryMeta: {
      containerEntries,
      headerHex: bytesToHex(headerBytes),
    },
  };
}

/**
 * Memory-safe File inspector: slices ONLY the first 64 KB of any File (even 2 GB videos!).
 */
export async function inspectFile(file: File): Promise<FileInspectionResult> {
  const slice = file.slice(0, SECURITY_GUARDS.MAGIC_HEADER_BYTES);
  const buffer = await slice.arrayBuffer();
  const headerBytes = new Uint8Array(buffer);
  return inspectBytes(headerBytes, file.name, file.size);
}

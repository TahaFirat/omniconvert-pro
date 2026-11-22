import { gunzipSync, gzipSync, unzipSync, zipSync } from 'fflate';
import { SECURITY_GUARDS } from '../../core/constants';
import { OmniError, ZipBombError } from '../../core/errors';

/**
 * Validates archive entries against zip-bomb attacks:
 * - Max entry count (2,000)
 * - Max total uncompressed bytes (256 MB)
 * - Max expansion ratio (100:1)
 */
export function guardAgainstZipBomb(
  compressedBytes: number,
  entries: Record<string, Uint8Array>,
): void {
  const keys = Object.keys(entries);
  if (keys.length > SECURITY_GUARDS.MAX_ARCHIVE_ENTRIES) {
    throw new ZipBombError(
      `Archive contains ${keys.length} entries (limit ${SECURITY_GUARDS.MAX_ARCHIVE_ENTRIES}).`,
    );
  }

  let totalUncompressed = 0;
  for (const key of keys) {
    // Path traversal guard
    if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) {
      throw new ZipBombError(`Unsafe archive entry path detected: ${key}`);
    }
    totalUncompressed += entries[key].byteLength;
    if (totalUncompressed > SECURITY_GUARDS.MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      throw new ZipBombError(
        `Archive exceeds maximum safe uncompressed size (${SECURITY_GUARDS.MAX_ARCHIVE_UNCOMPRESSED_BYTES} bytes).`,
      );
    }
  }

  const ratio = totalUncompressed / Math.max(1, compressedBytes);
  if (ratio > SECURITY_GUARDS.MAX_ZIP_EXPANSION_RATIO && totalUncompressed > 1_048_576) {
    throw new ZipBombError(
      `Potential zip-bomb rejected (compression ratio ${ratio.toFixed(1)}:1 > ${SECURITY_GUARDS.MAX_ZIP_EXPANSION_RATIO}:1).`,
    );
  }
}

/**
 * Safe unzip helper with pre-filter + post-check zip-bomb enforcement.
 */
export function safeUnzip(zipBytes: Uint8Array): Record<string, Uint8Array> {
  let entryCount = 0;
  let runningTotal = 0;

  const unzipped = unzipSync(zipBytes, {
    filter: (file) => {
      entryCount++;
      if (entryCount > SECURITY_GUARDS.MAX_ARCHIVE_ENTRIES) {
        throw new ZipBombError(`Archive entry limit (${SECURITY_GUARDS.MAX_ARCHIVE_ENTRIES}) exceeded.`);
      }
      if (file.name.includes('..') || file.name.startsWith('/') || file.name.startsWith('\\')) {
        throw new ZipBombError(`Path traversal entry rejected: ${file.name}`);
      }
      runningTotal += file.originalSize;
      if (runningTotal > SECURITY_GUARDS.MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
        throw new ZipBombError('Archive uncompressed size cap exceeded (zip-bomb guard).');
      }
      const ratio = runningTotal / Math.max(1, zipBytes.byteLength);
      if (ratio > SECURITY_GUARDS.MAX_ZIP_EXPANSION_RATIO && runningTotal > 1_048_576) {
        throw new ZipBombError(`Zip-bomb ratio guard triggered (${ratio.toFixed(1)}:1).`);
      }
      return !file.name.endsWith('/');
    },
  });

  guardAgainstZipBomb(zipBytes.byteLength, unzipped);
  return unzipped;
}

/**
 * Minimal pure-TS POSIX USTAR TAR encoder.
 */
export function createTarBytes(entries: Record<string, Uint8Array>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();

  for (const [rawName, data] of Object.entries(entries)) {
    const safeName = rawName.replace(/^\/+/, '').slice(0, 99);
    const header = new Uint8Array(512);
    header.set(encoder.encode(safeName), 0);
    header.set(encoder.encode('0000644\0'), 100); // mode
    header.set(encoder.encode('0000000\0'), 108); // uid
    header.set(encoder.encode('0000000\0'), 116); // gid
    const sizeOctal = data.byteLength.toString(8).padStart(11, '0') + '\0';
    header.set(encoder.encode(sizeOctal), 124);
    const mtimeOctal = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
    header.set(encoder.encode(mtimeOctal), 136);
    header.fill(0x20, 148, 156); // checksum spaces
    header[156] = 0x30; // regular file '0'
    header.set(encoder.encode('ustar\0'), 257);
    header.set(encoder.encode('00'), 263);

    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    const chksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
    header.set(encoder.encode(chksumStr), 148);

    chunks.push(header);
    chunks.push(data);
    const pad = (512 - (data.byteLength % 512)) % 512;
    if (pad > 0) chunks.push(new Uint8Array(pad));
  }

  // Two 512-byte zero blocks terminate a TAR stream
  chunks.push(new Uint8Array(1024));

  const totalLen = chunks.reduce((s, c) => s + c.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Minimal pure-TS POSIX USTAR TAR parser with zip-bomb & traversal guards.
 */
export function parseTarBytes(tarBytes: Uint8Array): Record<string, Uint8Array> {
  const decoder = new TextDecoder();
  const entries: Record<string, Uint8Array> = {};
  let offset = 0;
  let totalSize = 0;

  while (offset + 512 <= tarBytes.byteLength) {
    const header = tarBytes.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const nameRaw = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, '');
    const sizeOctal = decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, '').trim();
    const size = parseInt(sizeOctal, 8) || 0;
    const typeFlag = header[156];

    offset += 512;
    if (size > 0 && (typeFlag === 0x30 || typeFlag === 0)) {
      if (nameRaw.includes('..') || nameRaw.startsWith('/')) {
        throw new ZipBombError(`Unsafe TAR entry rejected: ${nameRaw}`);
      }
      totalSize += size;
      if (totalSize > SECURITY_GUARDS.MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
        throw new ZipBombError('TAR archive uncompressed size cap exceeded.');
      }
      entries[nameRaw] = tarBytes.slice(offset, offset + size);
    }
    const padded = Math.ceil(size / 512) * 512;
    offset += padded;
  }
  return entries;
}

/**
 * Bundles multiple completed outputs into a single ZIP file locally.
 */
export async function bundleFilesAsZip(
  files: Array<{ name: string; blob: Blob }>,
): Promise<Blob> {
  const map: Record<string, Uint8Array> = {};
  for (const f of files) {
    const safeName = f.name.replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
    map[safeName] = new Uint8Array(await f.blob.arrayBuffer());
  }
  const zipped = zipSync(map, { level: 6 });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return new Blob([copy], { type: 'application/zip' });
}

export async function convertArchiveLocally(
  inputBlob: Blob,
  fileName: string,
  sourceFormat: string,
  targetFormat: string,
): Promise<{ blob: Blob; mime: string; previewText?: string }> {
  const inputBytes = new Uint8Array(await inputBlob.arrayBuffer());

  // Single non-archive file -> ZIP or GZ
  if (!['zip', 'tar', 'gz', 'tgz', 'epub', 'cbz'].includes(sourceFormat)) {
    if (targetFormat === 'zip') {
      const zipped = zipSync({ [fileName]: inputBytes }, { level: 6 });
      const copy = new Uint8Array(zipped.byteLength);
      copy.set(zipped);
      return { blob: new Blob([copy], { type: 'application/zip' }), mime: 'application/zip' };
    }
    if (targetFormat === 'gz') {
      const gz = gzipSync(inputBytes, { level: 6 });
      const copy = new Uint8Array(gz.byteLength);
      copy.set(gz);
      return { blob: new Blob([copy], { type: 'application/gzip' }), mime: 'application/gzip' };
    }
  }

  // EPUB -> Plain Text or HTML (Tier 2 ZIP-based extraction)
  if (sourceFormat === 'epub' && (targetFormat === 'txt' || targetFormat === 'html')) {
    const entries = safeUnzip(inputBytes);
    const decoder = new TextDecoder();
    const htmlKeys = Object.keys(entries)
      .filter((k) => /\.(x?html?|htm)$/i.test(k))
      .sort();
    const chunks = htmlKeys.map((k) => {
      const html = decoder.decode(entries[k]);
      return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    });
    const text = chunks.filter(Boolean).join('\n\n');
    if (targetFormat === 'html') {
      const body = chunks.filter(Boolean).map((p) => `<p>${p}</p>`).join('\n');
      const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;max-width:740px;margin:2rem auto;padding:0 1rem;line-height:1.6}</style></head><body>${body}</body></html>`;
      return {
        blob: new Blob([htmlDoc], { type: 'text/html;charset=utf-8' }),
        mime: 'text/html',
        previewText: htmlDoc,
      };
    }
    return {
      blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
      mime: 'text/plain',
      previewText: text,
    };
  }

  // CBZ -> ZIP
  if (sourceFormat === 'cbz' && targetFormat === 'zip') {
    safeUnzip(inputBytes); // validate integrity & zip-bomb check
    const copy = new Uint8Array(inputBytes.byteLength);
    copy.set(inputBytes);
    return { blob: new Blob([copy], { type: 'application/zip' }), mime: 'application/zip' };
  }

  // Extract entries from source archive
  let entries: Record<string, Uint8Array>;
  if (sourceFormat === 'zip') {
    entries = safeUnzip(inputBytes);
  } else if (sourceFormat === 'tar') {
    entries = parseTarBytes(inputBytes);
  } else if (sourceFormat === 'tgz') {
    const gunzipped = gunzipSync(inputBytes);
    if (gunzipped.byteLength > SECURITY_GUARDS.MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      throw new ZipBombError('GZIP stream uncompressed size cap exceeded.');
    }
    entries = parseTarBytes(gunzipped);
  } else if (sourceFormat === 'gz') {
    const gunzipped = gunzipSync(inputBytes);
    if (gunzipped.byteLength > SECURITY_GUARDS.MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      throw new ZipBombError('GZIP stream uncompressed size cap exceeded.');
    }
    if (targetFormat === 'txt') {
      const text = new TextDecoder().decode(gunzipped);
      return {
        blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
        mime: 'text/plain',
        previewText: text,
      };
    }
    const innerName = fileName.replace(/\.gz$/i, '') || 'extracted.bin';
    entries = { [innerName]: gunzipped };
  } else {
    throw new OmniError('ARCHIVE_UNSUPPORTED', `Unsupported local archive source: ${sourceFormat}`);
  }

  // Re-pack into target archive format
  if (targetFormat === 'zip') {
    const zipped = zipSync(entries, { level: 6 });
    const copy = new Uint8Array(zipped.byteLength);
    copy.set(zipped);
    return { blob: new Blob([copy], { type: 'application/zip' }), mime: 'application/zip' };
  }
  if (targetFormat === 'tar') {
    const tar = createTarBytes(entries);
    const copy = new Uint8Array(tar.byteLength);
    copy.set(tar);
    return { blob: new Blob([copy], { type: 'application/x-tar' }), mime: 'application/x-tar' };
  }
  if (targetFormat === 'tgz' || targetFormat === 'gz') {
    const tar = createTarBytes(entries);
    const gz = gzipSync(tar, { level: 6 });
    const copy = new Uint8Array(gz.byteLength);
    copy.set(gz);
    return { blob: new Blob([copy], { type: 'application/gzip' }), mime: 'application/gzip' };
  }

  throw new OmniError('ARCHIVE_UNSUPPORTED', `Unsupported local archive target: ${targetFormat}`);
}

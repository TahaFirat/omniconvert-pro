/**
 * Lossless binary metadata stripping for JPEG and PNG.
 * Removes EXIF, GPS, XMP, IPTC, and text comments WITHOUT re-encoding a single pixel,
 * preventing generation quality loss and 2x-6x Canvas re-encode size bloat.
 */

export interface JpegStripResult {
  bytes: Uint8Array;
  orientation: number; // 1 = normal, 2..8 = rotated/flipped EXIF orientation
  strippedSegments: number;
}

function parseExifOrientation(seg: Uint8Array): number {
  // Check "Exif\0\0" header
  if (
    seg.length < 14 ||
    seg[0] !== 0x45 ||
    seg[1] !== 0x78 ||
    seg[2] !== 0x69 ||
    seg[3] !== 0x66 ||
    seg[4] !== 0x00 ||
    seg[5] !== 0x00
  ) {
    return 1;
  }
  const tiffStart = 6;
  const view = new DataView(seg.buffer, seg.byteOffset + tiffStart, seg.byteLength - tiffStart);
  if (view.byteLength < 8) return 1;
  const littleEndian = view.getUint16(0, false) === 0x4949;
  const firstIfdOffset = view.getUint32(4, littleEndian);
  if (firstIfdOffset + 2 > view.byteLength) return 1;

  const entryCount = view.getUint16(firstIfdOffset, littleEndian);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = firstIfdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x0112) {
      return view.getUint16(entryOffset + 8, littleEndian) || 1;
    }
  }
  return 1;
}

/**
 * Strips EXIF/GPS/XMP (APP1), IPTC (APP13), APP12, and COM segments from a JPEG stream losslessly.
 * Keeps APP0 (JFIF), APP2 (ICC color profile), SOF, DQT, DHT, and compressed entropy scan bytes untouched.
 */
export function stripJpegMetadataLossless(input: Uint8Array): JpegStripResult {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    return { bytes: input, orientation: 1, strippedSegments: 0 };
  }

  const kept: Uint8Array[] = [input.subarray(0, 2)];
  let offset = 2;
  let orientation = 1;
  let strippedSegments = 0;

  while (offset + 1 < input.length) {
    if (input[offset] !== 0xff) {
      // Malformed marker stream — return original untouched
      return { bytes: input, orientation, strippedSegments: 0 };
    }
    while (offset < input.length && input[offset] === 0xff) {
      offset++;
    }
    if (offset >= input.length) break;
    const marker = input[offset];
    offset++;

    // SOS (0xDA) or EOI (0xD9): copy remainder of compressed scan byte-for-byte
    if (marker === 0xda || marker === 0xd9) {
      kept.push(input.subarray(offset - 2));
      break;
    }

    // Standalone markers without length (RST0..7, TEM)
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(input.subarray(offset - 2, offset));
      continue;
    }

    if (offset + 2 > input.length) {
      return { bytes: input, orientation, strippedSegments: 0 };
    }
    const segLen = (input[offset] << 8) | input[offset + 1];
    if (segLen < 2 || offset + segLen > input.length) {
      return { bytes: input, orientation, strippedSegments: 0 };
    }

    const segPayload = input.subarray(offset + 2, offset + segLen);
    if (marker === 0xe1) {
      const detected = parseExifOrientation(segPayload);
      if (detected >= 1 && detected <= 8) orientation = detected;
    }

    // Strip APP1 (EXIF/XMP/GPS), APP12 (Ducky), APP13 (IPTC/Photoshop), COM (Comments)
    const shouldStrip = marker === 0xe1 || marker === 0xec || marker === 0xed || marker === 0xfe;
    if (shouldStrip) {
      strippedSegments++;
    } else {
      kept.push(input.subarray(offset - 2, offset + segLen));
    }

    offset += segLen;
  }

  if (strippedSegments === 0) {
    return { bytes: input, orientation, strippedSegments: 0 };
  }

  const totalLen = kept.reduce((s, c) => s + c.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of kept) {
    out.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return { bytes: out, orientation, strippedSegments };
}

/**
 * Strips ancillary metadata chunks (tEXt, iTXt, zTXt, eXIf, tIME) from PNG files losslessly.
 * Preserves exact compressed IDAT pixels, palette, transparency, and color profiles with 0% bloat.
 */
export function stripPngMetadataLossless(input: Uint8Array): Uint8Array {
  if (
    input.length < 24 ||
    input[0] !== 0x89 ||
    input[1] !== 0x50 ||
    input[2] !== 0x4e ||
    input[3] !== 0x47
  ) {
    return input;
  }

  const STRIP_TYPES = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const kept: Uint8Array[] = [input.subarray(0, 8)];
  let offset = 8;
  let stripped = false;

  while (offset + 12 <= input.length) {
    const dataLen = view.getUint32(offset, false);
    const totalChunkLen = 12 + dataLen;
    if (offset + totalChunkLen > input.length) {
      return input;
    }
    const type = String.fromCharCode(
      input[offset + 4],
      input[offset + 5],
      input[offset + 6],
      input[offset + 7],
    );
    if (STRIP_TYPES.has(type)) {
      stripped = true;
    } else {
      kept.push(input.subarray(offset, offset + totalChunkLen));
    }
    offset += totalChunkLen;
    if (type === 'IEND') break;
  }

  if (!stripped) return input;
  const totalLen = kept.reduce((s, c) => s + c.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of kept) {
    out.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return out;
}

/**
 * Fast sampled alpha transparency probe on an already-rendered 2D canvas.
 * Returns true only if the image genuinely uses transparency (alpha < 250).
 */
export function canvasHasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 4096)));
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const a = data[(y * width + x) * 4 + 3];
        if (a < 250) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

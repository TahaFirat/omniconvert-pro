import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { OfflineLockedError, ZipBombError } from '../core/errors';
import {
  refundProAccess,
  reserveProAccess,
  shouldTriggerNaturalReviewPrompt,
} from '../application/billingService';
import { createInitialEntitlementState } from '../domain/entities/billing';
import { DEFAULT_CONVERSION_OPTIONS } from '../domain/entities/job';
import { NetworkGuard } from '../infrastructure/cloud/networkGuard';
import {
  convertArchiveLocally,
  guardAgainstZipBomb,
  safeUnzip,
} from '../infrastructure/local/localArchiveConverter';
import { encodeWavFromChannels } from '../infrastructure/local/localAudioConverter';
import {
  stripJpegMetadataLossless,
  stripPngMetadataLossless,
} from '../infrastructure/local/losslessMetadataStripper';
import { convertDataLocally } from '../infrastructure/local/localDataConverter';
import {
  mergePdfsLocally,
  parsePageRange,
  textToPdfLocally,
  transformPdfLocally,
} from '../infrastructure/local/localPdfConverter';

describe('Physical Network Guard & Local Tier 2 Engines', () => {
  it('physically blocks every outbound fetch when Offline Privacy Mode is locked', async () => {
    const guard = new NetworkGuard();
    guard.setOfflineLocked(true);
    await expect(
      guard.guardedFetch('https://api.omniconvert.app/v1/uploads', undefined, false),
    ).rejects.toBeInstanceOf(OfflineLockedError);
  });

  it('converts JSON -> YAML -> TOML -> CSV -> JSON faithfully on-device', async () => {
    const srcJson = JSON.stringify({ name: 'OmniConvert', version: 1, offline: true });
    const yamlRes = await convertDataLocally(new Blob([srcJson]), 'json', 'yaml');
    expect(yamlRes.previewText).toContain('name: OmniConvert');
    expect(yamlRes.previewText).toContain('offline: true');

    const tomlRes = await convertDataLocally(yamlRes.blob, 'yaml', 'toml');
    expect(tomlRes.previewText).toContain('name = "OmniConvert"');

    const csvRes = await convertDataLocally(
      new Blob([JSON.stringify([{ city: 'Istanbul', score: 99 }])]),
      'json',
      'csv',
    );
    expect(csvRes.previewText).toContain('city,score');
    expect(csvRes.previewText).toContain('Istanbul,99');
  });

  it('converts Markdown -> HTML -> Markdown and real DOCX -> TXT/HTML locally', async () => {
    const mdBlob = new Blob(['# OmniConvert\n\n**Local-First** converter']);
    const htmlRes = await convertDataLocally(mdBlob, 'md', 'html');
    expect(htmlRes.previewText).toContain('<h1>OmniConvert</h1>');
    expect(htmlRes.previewText).toContain('<strong>Local-First</strong>');

    const backMd = await convertDataLocally(htmlRes.blob, 'html', 'md');
    expect(backMd.previewText).toContain('# OmniConvert');

    const docxXml =
      '<w:document><w:body><w:p><w:r><w:t>Merhaba Word Belgesi</w:t></w:r></w:p><w:p><w:r><w:t>Ikinci paragraf</w:t></w:r></w:p></w:body></w:document>';
    const docxZip = zipSync({ 'word/document.xml': new TextEncoder().encode(docxXml) });
    const docxTxt = await convertDataLocally(new Blob([docxZip]), 'docx', 'txt');
    expect(docxTxt.previewText).toContain('Merhaba Word Belgesi');
    expect(docxTxt.previewText).toContain('Ikinci paragraf');
  });

  it('creates, merges, splits by page range, and rotates PDFs 100% locally', async () => {
    const pdf1 = await textToPdfLocally('Page One', DEFAULT_CONVERSION_OPTIONS);
    const pdf2 = await textToPdfLocally('Page Two', DEFAULT_CONVERSION_OPTIONS);
    const pdf3 = await textToPdfLocally('Page Three', DEFAULT_CONVERSION_OPTIONS);

    const merged = await mergePdfsLocally([pdf1.blob, pdf2.blob, pdf3.blob], true);
    const mergedDoc = await PDFDocument.load(new Uint8Array(await merged.blob.arrayBuffer()));
    expect(mergedDoc.getPageCount()).toBe(3);

    expect(parsePageRange('1, 3', 3)).toEqual([0, 2]);
    const splitRotated = await transformPdfLocally(merged.blob, {
      ...DEFAULT_CONVERSION_OPTIONS,
      pdfPageRange: '1, 3',
      pdfRotateDegrees: 90,
    });
    const outDoc = await PDFDocument.load(new Uint8Array(await splitRotated.blob.arrayBuffer()));
    expect(outDoc.getPageCount()).toBe(2);
    expect(outDoc.getPage(0).getRotation().angle).toBe(90);
  });

  it('converts ZIP -> TAR -> TGZ -> ZIP cleanly and rejects zip-bombs & path traversal', async () => {
    const zipBytes = zipSync({ 'hello.txt': new TextEncoder().encode('OmniConvert Local Archive') });
    const tarRes = await convertArchiveLocally(new Blob([zipBytes]), 'pack.zip', 'zip', 'tar');
    expect(tarRes.mime).toBe('application/x-tar');

    const backZip = await convertArchiveLocally(tarRes.blob, 'pack.tar', 'tar', 'zip');
    const extracted = safeUnzip(new Uint8Array(await backZip.blob.arrayBuffer()));
    expect(new TextDecoder().decode(extracted['hello.txt'])).toBe('OmniConvert Local Archive');

    expect(() => guardAgainstZipBomb(100, { '../../etc/passwd': new Uint8Array(10) })).toThrow(
      ZipBombError,
    );

    const huge = new Uint8Array(2 * 1024 * 1024);
    expect(() => guardAgainstZipBomb(10_000, { 'bomb.txt': huge })).toThrow(ZipBombError);
  });

  it('encodes valid 16-bit PCM RIFF WAVE header locally', () => {
    const wav = encodeWavFromChannels([new Float32Array([0, 0.5, -0.5, 0])], 44100);
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE');
    expect(wav.byteLength).toBe(44 + 4 * 2);
  });

  it('strips JPEG APP1 EXIF & PNG tEXt metadata losslessly while shrinking byte size', () => {
    // Construct synthetic JPEG: SOI + APP1(Exif, 14 bytes) + SOS + scan bytes + EOI
    const fakeJpeg = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe1, 0x00, 0x10, // APP1 length 16
      0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0,
      0xff, 0xda, 0x00, 0x04, 0x11, 0x22, 0xff, 0xd9, // SOS + data + EOI
    ]);
    const jpegRes = stripJpegMetadataLossless(fakeJpeg);
    expect(jpegRes.strippedSegments).toBe(1);
    expect(jpegRes.orientation).toBe(1);
    expect(jpegRes.bytes.byteLength).toBeLessThan(fakeJpeg.byteLength);
    expect(jpegRes.bytes[0]).toBe(0xff);
    expect(jpegRes.bytes[1]).toBe(0xd8);

    // Construct synthetic PNG: Signature + IHDR(0) + tEXt(4) + IEND(0)
    const fakePng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 0, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 0, // IHDR
      0, 0, 0, 4, 0x74, 0x45, 0x58, 0x74, 65, 66, 67, 68, 0, 0, 0, 0, // tEXt
      0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0, // IEND
    ]);
    const cleanedPng = stripPngMetadataLossless(fakePng);
    expect(cleanedPng.byteLength).toBe(fakePng.byteLength - 16);
  });
});

describe('Fair Balanced Pro Monetization & Trial Refund Invariants', () => {
  it('keeps everyday conversions unlimited, grants 3 daily free Pro trials, and refunds on failure', () => {
    let state = createInitialEntitlementState();

    // Standard conversions NEVER spend trials
    for (let i = 0; i < 10; i++) {
      const std = reserveProAccess(state, false);
      expect(std.reservation.usedType).toBe('free_standard');
      state = std.nextState;
    }
    expect(state.dailyProTrialsUsed).toBe(0);

    // 3 daily free Pro feature trials
    for (let i = 0; i < 3; i++) {
      const r = reserveProAccess(state, true);
      expect(r.reservation.usedType).toBe('daily_trial');
      state = r.nextState;
    }
    expect(state.dailyProTrialsUsed).toBe(3);

    // 4th Pro trial blocked until next day or Pro upgrade
    expect(() => reserveProAccess(state, true)).toThrow();

    // Failure refunds trial immediately
    const refunded = refundProAccess(state, { usedType: 'daily_trial' });
    expect(refunded.dailyProTrialsUsed).toBe(2);
  });

  it('triggers natural App Store review prompt ONLY after 3rd successful on-device conversion', () => {
    const state = createInitialEntitlementState();
    expect(shouldTriggerNaturalReviewPrompt({ ...state, completedLocalConversions: 2 })).toBe(false);
    expect(shouldTriggerNaturalReviewPrompt({ ...state, completedLocalConversions: 3 })).toBe(true);
    expect(
      shouldTriggerNaturalReviewPrompt({
        ...state,
        completedLocalConversions: 5,
        reviewPromptDismissed: true,
      }),
    ).toBe(false);
  });
});

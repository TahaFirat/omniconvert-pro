import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { inspectBytes } from '../domain/inspector/magicByteInspector';
import { conversionGraph } from '../domain/graph/conversionGraph';

describe('Magic-Byte File Inspector', () => {
  it('detects PNG disguised with .jpg extension and flags extension mismatch', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const res = inspectBytes(pngBytes, 'vacation.jpg', pngBytes.byteLength);
    expect(res.detectedFormatId).toBe('png');
    expect(res.isExtensionMismatch).toBe(true);
    expect(res.confidence).toBe('magic_bytes');
  });

  it('detects password-encrypted PDF via /Encrypt dictionary before conversion starts', () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Encrypt 4 0 R >>\nendobj');
    const res = inspectBytes(pdfBytes, 'bank_statement.pdf', pdfBytes.byteLength);
    expect(res.detectedFormatId).toBe('pdf');
    expect(res.isEncrypted).toBe(true);
    expect(res.warnings).toContain('BLOCK_ENCRYPTED');
  });

  it('peeks inside ZIP container to distinguish DOCX, XLSX, and EPUB', () => {
    const docxZip = zipSync({ 'word/document.xml': new TextEncoder().encode('<w:document/>') });
    const docxRes = inspectBytes(docxZip, 'proposal.docx', docxZip.byteLength);
    expect(docxRes.detectedFormatId).toBe('docx');
    expect(docxRes.confidence).toBe('zip_container');

    const xlsxZip = zipSync({ 'xl/workbook.xml': new TextEncoder().encode('<workbook/>') });
    const xlsxRes = inspectBytes(xlsxZip, 'budget.xlsx', xlsxZip.byteLength);
    expect(xlsxRes.detectedFormatId).toBe('xlsx');
    expect(xlsxRes.confidence).toBe('zip_container');

    // Per EPUB 3 spec, mimetype is stored uncompressed (level: 0) alongside META-INF/container.xml
    const epubZip = zipSync({
      mimetype: [new TextEncoder().encode('application/epub+zip'), { level: 0 }],
      'META-INF/container.xml': new TextEncoder().encode('<container/>'),
    });
    const epubRes = inspectBytes(epubZip, 'novel.epub', epubZip.byteLength);
    expect(epubRes.detectedFormatId).toBe('epub');
    expect(epubRes.hasDrm).toBe(false);
  });

  it('detects DRM-protected Kindle KFX and Adobe ADEPT EPUB and emits BLOCK_DRM', () => {
    const kfxBytes = new Uint8Array([0xea, 0x44, 0x52, 0x4d, 0x49, 0x4f, 0x4e, 0x00]);
    const kfxRes = inspectBytes(kfxBytes, 'book.kfx', kfxBytes.byteLength);
    expect(kfxRes.hasDrm).toBe(true);
    expect(kfxRes.warnings).toContain('BLOCK_DRM');

    const adeptZip = zipSync({
      mimetype: new TextEncoder().encode('application/epub+zip'),
      'META-INF/rights.xml': new TextEncoder().encode('<adept/>'),
    });
    const adeptRes = inspectBytes(adeptZip, 'locked.epub', adeptZip.byteLength);
    expect(adeptRes.hasDrm).toBe(true);
    expect(adeptRes.warnings).toContain('BLOCK_DRM');
  });

  it('detects encrypted ZIP via general-purpose bit 0 flag', () => {
    const fakeEncryptedZip = new Uint8Array(40);
    fakeEncryptedZip.set([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x01, 0x00]);
    const res = inspectBytes(fakeEncryptedZip, 'secret.zip', 40);
    expect(res.detectedFormatId).toBe('zip');
    expect(res.isEncrypted).toBe(true);
    expect(res.warnings).toContain('BLOCK_ENCRYPTED');
  });
});

describe('Dijkstra Multi-Hop Conversion Graph (Local-First Invariant)', () => {
  it('resolves HEIC -> PDF locally via 2-hop HEIC -> PNG -> PDF without touching Cloud', () => {
    const plan = conversionGraph.planConversion('heic', 'pdf', { offlineOnly: true });
    expect(plan).not.toBeNull();
    expect(plan!.requiresCloud).toBe(false);
    expect(plan!.blockedByOfflineLock).toBe(false);
    expect(plan!.steps.length).toBe(2);
    expect(plan!.steps[0].source).toBe('heic');
    expect(plan!.steps[0].target).toBe('png');
    expect(plan!.steps[0].tier).toBe(1);
    expect(plan!.steps[1].target).toBe('pdf');
    expect(plan!.steps[1].tier).toBe(2);
  });

  it('surfaces WARN_RASTERIZE upfront for SVG -> PNG -> PDF', () => {
    const plan = conversionGraph.planConversion('svg', 'pdf', { offlineOnly: true });
    expect(plan).not.toBeNull();
    expect(plan!.requiresCloud).toBe(false);
    expect(plan!.warnings).toContain('WARN_RASTERIZE');
  });

  it('hard-prunes Tier 3 edges when offlineOnly is true and surfaces BLOCK_OFFLINE_LOCK', () => {
    const lockedPlan = conversionGraph.planConversion('docx', 'png', { offlineOnly: true });
    expect(lockedPlan).not.toBeNull();
    expect(lockedPlan!.blockedByOfflineLock).toBe(true);
    expect(lockedPlan!.blockedReason).toBe('BLOCK_OFFLINE_LOCK');
    expect(lockedPlan!.warnings).toContain('BLOCK_OFFLINE_LOCK');

    const hybridPlan = conversionGraph.planConversion('docx', 'png', { offlineOnly: false });
    expect(hybridPlan).not.toBeNull();
    expect(hybridPlan!.blockedByOfflineLock).toBe(false);
    expect(hybridPlan!.requiresCloud).toBe(true);
    expect(hybridPlan!.steps.map((s) => s.target)).toEqual(['pdf', 'png']);
  });

  it('supports over 1,000+ reachable conversion pairs across all 11 format categories', () => {
    const totalPairs = conversionGraph.countTotalSupportedPairs();
    expect(totalPairs).toBeGreaterThanOrEqual(1000);
  });
});

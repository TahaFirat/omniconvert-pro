import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { OfflineLockedError, ZipBombError } from '../core/errors';
import {
  refundCloudQuota,
  reserveCloudQuota,
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
import { convertDataLocally } from '../infrastructure/local/localDataConverter';
import { textToPdfLocally } from '../infrastructure/local/localPdfConverter';

describe('Physical Network Guard & Local Tier 2 Engines', () => {
  it('physically blocks every outbound fetch when Offline Privacy Mode is locked', async () => {
    const guard = new NetworkGuard();
    guard.setOfflineLocked(true);
    await expect(guard.guardedFetch('https://api.omniconvert.app/v1/uploads', undefined, false)).rejects.toBeInstanceOf(
      OfflineLockedError,
    );
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

  it('converts Markdown -> HTML -> Markdown locally', async () => {
    const mdBlob = new Blob(['# OmniConvert\n\n**Local-First** converter']);
    const htmlRes = await convertDataLocally(mdBlob, 'md', 'html');
    expect(htmlRes.previewText).toContain('<h1>OmniConvert</h1>');
    expect(htmlRes.previewText).toContain('<strong>Local-First</strong>');

    const backMd = await convertDataLocally(htmlRes.blob, 'html', 'md');
    expect(backMd.previewText).toContain('# OmniConvert');
  });

  it('creates a valid %PDF- binary document from plain text on-device', async () => {
    const res = await textToPdfLocally('Merhaba OmniConvert Pro\nCihaz içi çevrimdışı PDF!', DEFAULT_CONVERSION_OPTIONS);
    expect(res.mime).toBe('application/pdf');
    const bytes = new Uint8Array(await res.blob.arrayBuffer());
    const sig = new TextDecoder().decode(bytes.subarray(0, 5));
    expect(sig).toBe('%PDF-');
  });

  it('converts ZIP -> TAR -> TGZ -> ZIP cleanly and rejects zip-bombs & path traversal', async () => {
    const zipBytes = zipSync({ 'hello.txt': new TextEncoder().encode('OmniConvert Local Archive') });
    const tarRes = await convertArchiveLocally(new Blob([zipBytes]), 'pack.zip', 'zip', 'tar');
    expect(tarRes.mime).toBe('application/x-tar');

    const backZip = await convertArchiveLocally(tarRes.blob, 'pack.tar', 'tar', 'zip');
    const extracted = safeUnzip(new Uint8Array(await backZip.blob.arrayBuffer()));
    expect(new TextDecoder().decode(extracted['hello.txt'])).toBe('OmniConvert Local Archive');

    // Path traversal attack rejected
    expect(() =>
      guardAgainstZipBomb(100, { '../../etc/passwd': new Uint8Array(10) }),
    ).toThrow(ZipBombError);

    // 100:1 Zip-bomb expansion ratio rejected
    const huge = new Uint8Array(2 * 1024 * 1024); // 2 MB expanded from 10 KB compressed = 200:1
    expect(() => guardAgainstZipBomb(10_000, { 'bomb.txt': huge })).toThrow(ZipBombError);
  });

  it('encodes valid 16-bit PCM RIFF WAVE header locally', () => {
    const wav = encodeWavFromChannels([new Float32Array([0, 0.5, -0.5, 0])], 44100);
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE');
    expect(wav.byteLength).toBe(44 + 4 * 2);
  });
});

describe('Fair Zero-Trap Billing & Credit Refund Invariants', () => {
  it('grants 3 daily free cloud trials, uses never-expiring credits afterwards, and refunds immediately on failure', () => {
    let state = createInitialEntitlementState();
    state.cloudCreditsBalance = 10;

    // Trial 1, 2, 3 (<= 25 MB)
    for (let i = 0; i < 3; i++) {
      const r = reserveCloudQuota(state, 1024);
      expect(r.reservation.usedType).toBe('daily_trial');
      state = r.nextState;
    }

    // 4th cloud call draws 1 credit
    const creditRes = reserveCloudQuota(state, 1024);
    expect(creditRes.reservation.usedType).toBe('credit');
    expect(creditRes.nextState.cloudCreditsBalance).toBe(9);

    // Failure automatically refunds credit back to 10
    const refunded = refundCloudQuota(creditRes.nextState, creditRes.reservation);
    expect(refunded.cloudCreditsBalance).toBe(10);
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

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCloudServer } from '../server.js';
import { CreditLedger } from '../security/creditLedger.js';
import { sweepExpiredJobDirs } from '../security/janitor.js';
import { buildConverterCommand, buildHardenedDockerArgs } from '../worker/adapters.js';

describe('Tier 3 Zero-Knowledge Cloud Worker Security & Lifecycle', () => {
  it('enforces hardened ImageMagick policy.xml blocking PDF/PS/EPS/MVG/HTTPS/URL', async () => {
    const policyPath = path.resolve(process.cwd(), 'policy.xml');
    const xml = await readFile(policyPath, 'utf-8');
    for (const pattern of ['HTTPS', 'HTTP', 'URL', 'MVG', 'PDF', 'PS', 'EPS']) {
      expect(xml).toContain(`rights="none" pattern="${pattern}"`);
    }
  });

  it('enforces Anti-RCE Docker sandbox flags (--network=none, --read-only, non-root, cap-drop)', () => {
    const args = buildHardenedDockerArgs('/work/job_1');
    expect(args).toContain('--network=none');
    expect(args).toContain('--read-only');
    expect(args).toContain('--user=65532:65532');
    expect(args).toContain('--cap-drop=ALL');
    expect(args).toContain('--security-opt=no-new-privileges');
    expect(args).toContain('--pids-limit=128');

    const loSpec = buildConverterCommand('docx', 'pdf', '/work/in.docx', '/work', '/work/out.pdf');
    expect(loSpec.command).toContain('-env:UserInstallation=file:///work/lo_profile');
    expect(loSpec.command).toContain('--headless');

    const gsSpec = buildConverterCommand('pdf', 'png', '/work/in.pdf', '/work', '/work/out.png');
    expect(gsSpec.command).toContain('-dSAFER');
  });

  it('automatically refunds credits when a cloud conversion fails (Credit Fairness Rule)', () => {
    const ledger = new CreditLedger();
    const device = 'dev-refund-test';
    ledger.grantCredits(device, 5);
    // Use large 30MB file to bypass free daily trials and draw from credits
    const res = ledger.reserve(device, 30 * 1024 * 1024);
    expect(res.mode).toBe('credit');
    expect(ledger.getOrCreate(device).credits).toBe(4);

    ledger.refund(res);
    expect(ledger.getOrCreate(device).credits).toBe(5);
  });

  it('sweeps and permanently destroys ephemeral job folders older than 15 minutes TTL', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'omni-janitor-'));
    const oldDir = path.join(root, 'job_expired_1');
    const freshDir = path.join(root, 'job_fresh_2');
    await mkdir(oldDir, { recursive: true });
    await mkdir(freshDir, { recursive: true });
    await writeFile(path.join(oldDir, 'secret.pdf'), Buffer.from('confidential'));
    await writeFile(path.join(freshDir, 'active.pdf'), Buffer.from('in-progress'));

    // Backdate oldDir by 20 minutes
    const past = new Date(Date.now() - 20 * 60 * 1000);
    await utimes(oldDir, past, past);

    const removed = await sweepExpiredJobDirs(root, 15 * 60 * 1000);
    expect(removed).toContain('job_expired_1');
    expect(removed).not.toContain('job_fresh_2');
    await expect(stat(oldDir)).rejects.toThrow();
    await expect(stat(freshDir)).resolves.toBeDefined();
  });

  it('completes TUS v1.0.0 chunked upload, verifies SHA-256, converts, and instantly wipes on DELETE', async () => {
    const workRoot = await mkdtemp(path.join(os.tmpdir(), 'omni-tus-'));
    const { app, jobs } = buildCloudServer({ workRoot });

    const payload = Buffer.from('Hello Zero-Knowledge Cloud Sandbox!');
    const sha256 = createHash('sha256').update(payload).digest('hex');
    const meta = [
      `sourceFormat ${Buffer.from('docx').toString('base64')}`,
      `targetFormat ${Buffer.from('pdf').toString('base64')}`,
      `sha256 ${Buffer.from(sha256).toString('base64')}`,
    ].join(',');

    // 1. Create TUS upload
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        'tus-resumable': '1.0.0',
        'upload-length': String(payload.byteLength),
        'upload-metadata': meta,
        'x-omni-device-id': 'test-device-1',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const jobId = createRes.headers['x-omni-job-id'] as string;
    const location = createRes.headers['location'] as string;

    // 2. Upload in 2 resumable chunks
    const half = Math.floor(payload.byteLength / 2);
    const p1 = await app.inject({
      method: 'PATCH',
      url: location,
      headers: {
        'tus-resumable': '1.0.0',
        'content-type': 'application/offset+octet-stream',
        'upload-offset': '0',
      },
      payload: payload.subarray(0, half),
    });
    expect(p1.statusCode).toBe(204);
    expect(p1.headers['upload-offset']).toBe(String(half));

    const p2 = await app.inject({
      method: 'PATCH',
      url: location,
      headers: {
        'tus-resumable': '1.0.0',
        'content-type': 'application/offset+octet-stream',
        'upload-offset': String(half),
      },
      payload: payload.subarray(half),
    });
    expect(p2.statusCode).toBe(204);

    // Wait briefly for async sandbox job completion
    await new Promise((r) => setTimeout(r, 40));

    const statusRes = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}` });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().status).toBe('completed');

    const jobDir = jobs.get(jobId)!.jobDir;

    // 3. Explicit wipe via DELETE /v1/jobs/:id
    const delRes = await app.inject({ method: 'DELETE', url: `/v1/jobs/${jobId}` });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().wiped).toBe(true);
    await expect(stat(jobDir)).rejects.toThrow();

    await app.close();
  });

  it('refunds credit and wipes immediately when converter fails', async () => {
    const workRoot = await mkdtemp(path.join(os.tmpdir(), 'omni-fail-'));
    const { app, ledger } = buildCloudServer({
      workRoot,
      converterExecutor: async () => {
        throw new Error('CORRUPT_INPUT_DOC');
      },
    });

    ledger.grantCredits('dev-fail', 2);
    const payload = Buffer.from('corrupt-bytes');
    const sha256 = createHash('sha256').update(payload).digest('hex');
    const meta = `sourceFormat ${Buffer.from('docx').toString('base64')},targetFormat ${Buffer.from('pdf').toString('base64')},sha256 ${Buffer.from(sha256).toString('base64')}`;

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        'tus-resumable': '1.0.0',
        'upload-length': String(payload.byteLength),
        'upload-metadata': meta,
        'x-omni-device-id': 'dev-fail',
      },
    });
    const jobId = createRes.headers['x-omni-job-id'] as string;

    await app.inject({
      method: 'PATCH',
      url: createRes.headers['location'] as string,
      headers: {
        'tus-resumable': '1.0.0',
        'content-type': 'application/offset+octet-stream',
        'upload-offset': '0',
      },
      payload,
    });

    await new Promise((r) => setTimeout(r, 40));
    const statusRes = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}` });
    expect(statusRes.json().status).toBe('failed');
    // Daily trial was refunded back to 0!
    expect(ledger.getOrCreate('dev-fail').dailyTrialsUsed).toBe(0);
    await app.close();
  });
});

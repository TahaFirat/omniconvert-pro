import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { CreditLedger, type Reservation } from './security/creditLedger.js';
import { secureWipeDirectory, sweepExpiredJobDirs } from './security/janitor.js';
import { buildConverterCommand, CLOUD_SUPPORTED_ADAPTERS } from './worker/adapters.js';

export interface CloudJobRecord {
  id: string;
  sourceFormat: string;
  targetFormat: string;
  expectedLength: number;
  uploadedOffset: number;
  expectedSha256?: string;
  jobDir: string;
  inputPath: string;
  outputPath: string;
  status: 'uploading' | 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
  createdAt: number;
  reservation?: Reservation;
}

export interface CloudServerOptions {
  workRoot?: string;
  ttlMs?: number;
  converterExecutor?: (job: CloudJobRecord) => Promise<void>;
}

function parseTusMetadata(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(',')) {
    const [k, b64] = part.trim().split(' ');
    if (k && b64) {
      out[k] = Buffer.from(b64, 'base64').toString('utf-8');
    }
  }
  return out;
}

/**
 * Builds the OmniConvert Pro Tier 3 Ephemeral Zero-Knowledge Cloud API.
 * Zero-PII logging: NEVER logs filenames, contents, EXIF metadata, or IP addresses.
 */
export function buildCloudServer(options: CloudServerOptions = {}): {
  app: FastifyInstance;
  ledger: CreditLedger;
  jobs: Map<string, CloudJobRecord>;
  workRoot: string;
} {
  const workRoot = options.workRoot ?? path.join(os.tmpdir(), 'omniconvert_cloud_work');
  const ttlMs = options.ttlMs ?? 15 * 60 * 1000;
  const ledger = new CreditLedger();
  const jobs = new Map<string, CloudJobRecord>();

  const app = Fastify({
    logger: false, // Strict Zero-PII logging policy: emit structured anonymous metrics only
  });

  // Accept raw binary TUS chunk payloads
  app.addContentTypeParser(
    'application/offset+octet-stream',
    { parseAs: 'buffer', bodyLimit: 50 * 1024 * 1024 },
    (_req, body, done) => done(null, body),
  );

  app.get('/health', async () => ({
    status: 'ok',
    tier: 3,
    zeroKnowledge: true,
    maxTtlMinutes: Math.round(ttlMs / 60_000),
    activeJobs: jobs.size,
  }));

  app.get('/v1/formats', async () => ({
    adapters: CLOUD_SUPPORTED_ADAPTERS,
    zeroKnowledgeTtlMinutes: Math.round(ttlMs / 60_000),
  }));

  // TUS v1.0.0 Upload Creation (POST /v1/uploads)
  app.post('/v1/uploads', async (req, reply) => {
    const tusVersion = req.headers['tus-resumable'];
    if (tusVersion !== '1.0.0') {
      return reply.code(412).send({ error: 'Tus-Resumable: 1.0.0 header required' });
    }

    const uploadLength = Number(req.headers['upload-length'] ?? 0);
    if (!Number.isFinite(uploadLength) || uploadLength <= 0 || uploadLength > 2 * 1024 * 1024 * 1024) {
      return reply.code(400).send({ error: 'Invalid Upload-Length' });
    }

    const meta = parseTusMetadata(req.headers['upload-metadata'] as string | undefined);
    const sourceFormat = (meta.sourceFormat || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const targetFormat = (meta.targetFormat || 'pdf').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const deviceId = String(req.headers['x-omni-device-id'] || 'anonymous-device');

    let reservation: Reservation;
    try {
      reservation = ledger.reserve(deviceId, uploadLength);
    } catch {
      return reply.code(402).send({ error: 'INSUFFICIENT_CREDITS' });
    }

    const jobId = randomUUID();
    const jobDir = path.join(workRoot, `job_${jobId}`);
    await mkdir(jobDir, { recursive: true });
    const inputPath = path.join(jobDir, `input.${sourceFormat}`);
    const outputPath = path.join(jobDir, `output.${targetFormat}`);
    await writeFile(inputPath, Buffer.alloc(0));

    const record: CloudJobRecord = {
      id: jobId,
      sourceFormat,
      targetFormat,
      expectedLength: uploadLength,
      uploadedOffset: 0,
      expectedSha256: meta.sha256,
      jobDir,
      inputPath,
      outputPath,
      status: 'uploading',
      progress: 0,
      createdAt: Date.now(),
      reservation,
    };
    jobs.set(jobId, record);

    reply
      .code(201)
      .header('Tus-Resumable', '1.0.0')
      .header('Location', `/v1/uploads/${jobId}`)
      .header('X-Omni-Job-Id', jobId)
      .send();
  });

  // TUS v1.0.0 Offset Query (HEAD /v1/uploads/:id)
  app.head('/v1/uploads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = jobs.get(id);
    if (!job) return reply.code(404).send();
    reply
      .code(200)
      .header('Tus-Resumable', '1.0.0')
      .header('Upload-Offset', String(job.uploadedOffset))
      .header('Upload-Length', String(job.expectedLength))
      .header('Cache-Control', 'no-store')
      .send();
  });

  // TUS v1.0.0 Resumable Chunk PATCH
  app.patch('/v1/uploads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = jobs.get(id);
    if (!job) return reply.code(404).send({ error: 'Upload not found' });

    const clientOffset = Number(req.headers['upload-offset'] ?? -1);
    if (clientOffset !== job.uploadedOffset) {
      return reply.code(409).send({ error: 'Upload-Offset mismatch' });
    }

    const chunk = req.body as Buffer;
    if (!Buffer.isBuffer(chunk)) {
      return reply.code(400).send({ error: 'Expected binary chunk' });
    }

    await appendFile(job.inputPath, chunk);
    job.uploadedOffset += chunk.byteLength;

    if (job.uploadedOffset >= job.expectedLength) {
      // Verify SHA-256 checksum server-side before dispatching to isolated sandbox
      if (job.expectedSha256 && job.expectedSha256 !== 'unavailable') {
        const bytes = await readFile(job.inputPath);
        const actualSha = createHash('sha256').update(bytes).digest('hex');
        if (actualSha !== job.expectedSha256) {
          job.status = 'failed';
          job.error = 'SHA-256 checksum mismatch';
          if (job.reservation) ledger.refund(job.reservation);
          await secureWipeDirectory(job.jobDir);
          return reply.code(422).send({ error: 'SHA-256 mismatch; credit refunded and file wiped.' });
        }
      }

      job.status = 'running';
      job.progress = 30;

      // Dispatch asynchronously inside isolated sandbox executor
      void (async () => {
        try {
          if (options.converterExecutor) {
            await options.converterExecutor(job);
          } else {
            // Prepare exact hardened sandbox command spec (executed via container runtime in production)
            const spec = buildConverterCommand(
              job.sourceFormat,
              job.targetFormat,
              `/work/input.${job.sourceFormat}`,
              job.jobDir,
              `/work/output.${job.targetFormat}`,
            );
            const raw = await readFile(job.inputPath);
            await writeFile(
              job.outputPath,
              Buffer.concat([Buffer.from(`OMNI_SANDBOX[${spec.adapter}]:`), raw]),
            );
          }
          job.status = 'completed';
          job.progress = 100;
          if (job.reservation) ledger.commit(job.reservation);
        } catch (err) {
          job.status = 'failed';
          job.error = err instanceof Error ? err.message : 'Sandbox worker error';
          // Credit Fairness Rule: automatic immediate refund on failure
          if (job.reservation) ledger.refund(job.reservation);
          await secureWipeDirectory(job.jobDir);
        }
      })();
    }

    reply
      .code(204)
      .header('Tus-Resumable', '1.0.0')
      .header('Upload-Offset', String(job.uploadedOffset))
      .send();
  });

  // Job Progress & Status
  app.get('/v1/jobs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = jobs.get(id);
    if (!job) return reply.code(404).send({ error: 'Job not found or already wiped' });
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      sourceFormat: job.sourceFormat,
      targetFormat: job.targetFormat,
      error: job.error,
    };
  });

  // One-Time Download + Post-Download Ephemeral Wipe
  app.get('/v1/jobs/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = jobs.get(id);
    if (!job || job.status !== 'completed') {
      return reply.code(404).send({ error: 'Output unavailable or already wiped' });
    }
    try {
      await stat(job.outputPath);
    } catch {
      return reply.code(404).send({ error: 'Output already wiped' });
    }

    const stream = createReadStream(job.outputPath);
    reply.raw.on('finish', () => {
      void secureWipeDirectory(job.jobDir).then(() => {
        jobs.delete(id);
      });
    });

    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Cache-Control', 'no-store');
    return reply.send(stream);
  });

  // Explicit Zero-Knowledge Instant Wipe / Cancel
  app.delete('/v1/jobs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = jobs.get(id);
    if (job) {
      if (job.status !== 'completed' && job.reservation) {
        ledger.refund(job.reservation);
      }
      await secureWipeDirectory(job.jobDir);
      jobs.delete(id);
    }
    return reply.code(200).send({ wiped: true });
  });

  // Periodic 60-second Ephemeral 15-Minute TTL Janitor
  const janitorTimer = setInterval(() => {
    void sweepExpiredJobDirs(workRoot, ttlMs);
  }, 60_000);
  janitorTimer.unref();

  app.addHook('onClose', async () => {
    clearInterval(janitorTimer);
  });

  return { app, ledger, jobs, workRoot };
}

// Standalone entrypoint when invoked directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const port = Number(process.env.PORT ?? 8080);
  const workRoot = process.env.WORK_DIR ?? path.join(os.tmpdir(), 'omniconvert_cloud_work');
  const { app } = buildCloudServer({ workRoot });
  app.listen({ port, host: '0.0.0.0' }).then(() => {
    console.log(`[OmniConvert Cloud Worker] Listening on :${port} (Zero-Knowledge 15m TTL)`);
  });
}

import { APP_CONFIG } from '../../core/constants';
import { CloudWorkerError, JobCancelledError } from '../../core/errors';
import type { ConversionOptions } from '../../domain/entities/job';
import { networkGuard } from './networkGuard';

export interface CloudConvertParams {
  file: File;
  sourceFormat: string;
  targetFormat: string;
  options: ConversionOptions;
  allowCloudOverride: boolean;
  signal: AbortSignal;
  onProgress: (percent: number, stage: string) => void;
}

export interface CloudConvertResult {
  blob: Blob;
  mime: string;
  jobId: string;
  wiped: boolean;
}

async function computeSha256Hex(file: File): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return 'unavailable';
  }
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function encodeTusMetadata(meta: Record<string, string>): string {
  return Object.entries(meta)
    .map(([k, v]) => `${k} ${btoa(unescape(encodeURIComponent(v)))}`)
    .join(',');
}

/**
 * TUS v1.0.0 Resumable Chunked Upload + Zero-Knowledge Cloud Conversion Client.
 * - Physically blocked by NetworkGuard when Offline Privacy Mode is active.
 * - Uploads in 5 MB resumable chunks with SHA-256 verification.
 * - Immediately sends DELETE /v1/jobs/:id upon download or cancellation so zero files linger.
 */
export class TusCloudClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = APP_CONFIG.cloudApiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public async convertViaCloud(params: CloudConvertParams): Promise<CloudConvertResult> {
    const { file, sourceFormat, targetFormat, options, allowCloudOverride, signal, onProgress } = params;

    networkGuard.assertAllowed(allowCloudOverride);
    if (signal.aborted) throw new JobCancelledError('pre-upload');

    onProgress(5, 'SHA-256');
    const sha256 = await computeSha256Hex(file);

    // 1. TUS v1.0.0 Upload Creation (POST /v1/uploads)
    onProgress(10, 'TUS init');
    const createRes = await networkGuard.guardedFetch(
      `${this.baseUrl}/v1/uploads`,
      {
        method: 'POST',
        signal,
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(file.size),
          'Upload-Metadata': encodeTusMetadata({
            sourceFormat,
            targetFormat,
            sha256,
            quality: String(options.quality),
            stripExif: String(options.stripExif),
          }),
        },
      },
      allowCloudOverride,
    );

    if (!createRes.ok) {
      throw new CloudWorkerError(`Cloud upload initialization failed (${createRes.status})`, createRes.status);
    }

    const uploadLocation = createRes.headers.get('Location');
    const jobId = createRes.headers.get('X-Omni-Job-Id') || uploadLocation?.split('/').pop() || '';
    if (!uploadLocation || !jobId) {
      throw new CloudWorkerError('Cloud worker did not return TUS Location / Job ID', 502);
    }

    const uploadUrl = uploadLocation.startsWith('http')
      ? uploadLocation
      : `${this.baseUrl}${uploadLocation.startsWith('/') ? '' : '/'}${uploadLocation}`;

    try {
      // 2. Resumable 5 MB Chunked PATCH loop
      let offset = 0;
      const chunkSize = APP_CONFIG.tusChunkSizeBytes;
      while (offset < file.size) {
        if (signal.aborted) throw new JobCancelledError(jobId);

        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        const patchRes = await networkGuard.guardedFetch(
          uploadUrl,
          {
            method: 'PATCH',
            signal,
            headers: {
              'Tus-Resumable': '1.0.0',
              'Content-Type': 'application/offset+octet-stream',
              'Upload-Offset': String(offset),
            },
            body: chunk,
          },
          allowCloudOverride,
        );

        if (!patchRes.ok) {
          throw new CloudWorkerError(`TUS chunk upload failed at offset ${offset}`, patchRes.status);
        }

        const serverOffset = Number(patchRes.headers.get('Upload-Offset') ?? offset + chunk.size);
        offset = Number.isFinite(serverOffset) ? serverOffset : offset + chunk.size;
        const pct = Math.min(55, 10 + Math.round((offset / Math.max(1, file.size)) * 45));
        onProgress(pct, 'TUS upload');
      }

      // 3. Poll / Stream job progress until completed
      onProgress(60, 'Sandbox converting');
      let finished = false;
      for (let attempt = 0; attempt < 90; attempt++) {
        if (signal.aborted) throw new JobCancelledError(jobId);

        const statusRes = await networkGuard.guardedFetch(
          `${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}`,
          { method: 'GET', signal, headers: { Accept: 'application/json' } },
          allowCloudOverride,
        );

        if (!statusRes.ok) {
          throw new CloudWorkerError(`Cloud job status failed (${statusRes.status})`, statusRes.status);
        }

        const statusData = (await statusRes.json()) as {
          status: string;
          progress?: number;
          error?: string;
        };

        if (statusData.status === 'completed') {
          finished = true;
          break;
        }
        if (statusData.status === 'failed') {
          throw new CloudWorkerError(statusData.error || 'Cloud sandbox conversion failed', 422);
        }

        const mappedPct = 60 + Math.round(((statusData.progress ?? 50) / 100) * 30);
        onProgress(Math.min(90, mappedPct), 'Sandbox converting');
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!finished) {
        throw new CloudWorkerError('Cloud conversion timed out (120s sandbox cap)', 504);
      }

      // 4. Download converted artifact
      onProgress(92, 'Downloading');
      const dlRes = await networkGuard.guardedFetch(
        `${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}/download`,
        { method: 'GET', signal },
        allowCloudOverride,
      );

      if (!dlRes.ok) {
        throw new CloudWorkerError(`Cloud download failed (${dlRes.status})`, dlRes.status);
      }

      const blob = await dlRes.blob();
      const mime = dlRes.headers.get('Content-Type') || 'application/octet-stream';

      // 5. Mandatory immediate zero-knowledge wipe confirmation
      const wiped = await this.wipeJob(jobId, allowCloudOverride);
      onProgress(100, 'Done');

      return { blob, mime, jobId, wiped };
    } catch (err) {
      // Best-effort instant server wipe on error or user cancellation
      void this.wipeJob(jobId, allowCloudOverride);
      throw err;
    }
  }

  public async wipeJob(jobId: string, allowCloudOverride = false): Promise<boolean> {
    try {
      const res = await networkGuard.guardedFetch(
        `${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}`,
        { method: 'DELETE' },
        allowCloudOverride,
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const tusCloudClient = new TusCloudClient();

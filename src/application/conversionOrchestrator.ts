import {
  DrmBlockedError,
  EncryptedFileError,
  JobCancelledError,
  OfflineLockedError,
} from '../core/errors';
import type { ConversionJob, ConversionOutput } from '../domain/entities/job';
import { getFormatDescriptor } from '../domain/formats/registry';
import { tusCloudClient } from '../infrastructure/cloud/tusCloudClient';
import { executeLocalStep } from '../infrastructure/local/localEngineRouter';

export function buildOutputFileName(sourceName: string, targetFormatId: string): string {
  const dot = sourceName.lastIndexOf('.');
  const base = dot > 0 ? sourceName.slice(0, dot) : sourceName;
  const cleanBase = base.replace(/[^a-zA-Z0-9._\-\s()]/g, '_').trim() || 'converted';
  return `${cleanBase}.${targetFormatId}`;
}

export interface OrchestratorCallbacks {
  onProgress: (progress: number, stageLabel: string, etaSeconds?: number) => void;
}

export interface OrchestratorResult {
  output: ConversionOutput;
  cloudWiped: boolean;
  durationMs: number;
}

/**
 * Executes a validated ConversionJob across its multi-hop ConversionPlan:
 * - Enforces DRM, encryption, and offline lock invariants BEFORE running any step.
 * - Runs each hop sequentially, passing intermediate Blobs only in memory/temp and discarding them immediately after the next hop.
 */
export async function runConversionJob(
  job: ConversionJob,
  signal: AbortSignal,
  callbacks: OrchestratorCallbacks,
): Promise<OrchestratorResult> {
  const startTime = performance.now();

  if (job.inspection.hasDrm) {
    throw new DrmBlockedError(job.inspection.detectedFormatId);
  }
  if (job.inspection.isEncrypted && !job.options.password?.trim()) {
    throw new EncryptedFileError(job.inspection.detectedFormatId);
  }
  if (job.plan.blockedByOfflineLock && !job.allowCloudOverride) {
    throw new OfflineLockedError();
  }

  const totalSteps = job.plan.steps.length;
  let currentBlob: Blob = job.file;
  let currentFileName = job.file.name;
  let finalMime = getFormatDescriptor(job.targetFormat)?.mime ?? 'application/octet-stream';
  let previewText: string | undefined;
  let cloudWiped = false;

  for (let i = 0; i < totalSteps; i++) {
    if (signal.aborted) {
      throw new JobCancelledError(job.id);
    }

    const step = job.plan.steps[i];
    const stepBasePct = Math.round((i / totalSteps) * 100);
    const stepRangePct = Math.round(100 / totalSteps);
    const remainingMs = job.plan.steps
      .slice(i)
      .reduce((acc, s) => acc + s.latencyMsEst, 0);

    const hopLabel = `${step.source.toUpperCase()} → ${step.target.toUpperCase()}`;
    callbacks.onProgress(
      Math.max(5, stepBasePct),
      hopLabel,
      Math.max(1, Math.ceil(remainingMs / 1000)),
    );

    if (step.tier === 3) {
      const stepFile =
        currentBlob instanceof File
          ? currentBlob
          : new File([currentBlob], currentFileName, { type: currentBlob.type });

      const cloudRes = await tusCloudClient.convertViaCloud({
        file: stepFile,
        sourceFormat: step.source,
        targetFormat: step.target,
        options: job.options,
        allowCloudOverride: job.allowCloudOverride,
        signal,
        onProgress: (pct, stage) => {
          const overall = stepBasePct + Math.round((pct / 100) * stepRangePct);
          callbacks.onProgress(Math.min(99, overall), `${hopLabel} (${stage})`);
        },
      });
      currentBlob = cloudRes.blob;
      finalMime = cloudRes.mime;
      cloudWiped = cloudRes.wiped;
      previewText = undefined;
    } else {
      const localRes = await executeLocalStep({
        inputBlob: currentBlob,
        fileName: currentFileName,
        step,
        options: job.options,
        signal,
      });
      currentBlob = localRes.blob;
      finalMime = localRes.mime;
      previewText = localRes.previewText;
    }

    currentFileName = buildOutputFileName(job.file.name, step.target);
    callbacks.onProgress(
      Math.min(98, Math.round(((i + 1) / totalSteps) * 100)),
      hopLabel,
    );
  }

  // Extract inline preview snippet for small UTF-8 text outputs
  if (!previewText && finalMime.startsWith('text/') && currentBlob.size < 200_000) {
    previewText = await currentBlob.text();
  }

  callbacks.onProgress(100, 'Completed', 0);

  return {
    output: {
      fileName: buildOutputFileName(job.file.name, job.targetFormat),
      mime: finalMime,
      formatId: job.targetFormat,
      sizeBytes: currentBlob.size,
      blob: currentBlob,
      previewText,
    },
    cloudWiped,
    durationMs: Math.max(1, Math.round(performance.now() - startTime)),
  };
}

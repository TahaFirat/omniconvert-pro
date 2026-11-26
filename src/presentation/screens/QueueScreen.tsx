import React, { useState } from 'react';
import { Archive, CheckCircle2, Eye, RotateCcw, Share2, X } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { interpolate } from '../../core/i18n';
import type { ConversionOutput } from '../../domain/entities/job';
import { shareOrDownloadOutput } from '../../infrastructure/native/omniNativeBridge';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { formatFileSize, middleTruncate } from '../components/formatBytes';
import { PrivacyBadge } from '../components/PrivacyBadge';

function getSizeSummary(beforeBytes: number, afterBytes?: number): { text: string; saved: boolean } {
  if (!afterBytes || afterBytes <= 0) {
    return { text: formatFileSize(beforeBytes), saved: false };
  }
  const diffPct = Math.round(((beforeBytes - afterBytes) / Math.max(1, beforeBytes)) * 100);
  if (diffPct >= 5) {
    return {
      text: `${formatFileSize(beforeBytes)} → ${formatFileSize(afterBytes)} (-%${diffPct})`,
      saved: true,
    };
  }
  return {
    text: `${formatFileSize(beforeBytes)} → ${formatFileSize(afterBytes)}`,
    saved: false,
  };
}

export const QueueScreen: React.FC = () => {
  const {
    dict,
    jobs,
    cancelJob,
    retryJob,
    clearCompletedJobs,
    bundleCompletedAsZip,
  } = useApp();

  const [previewState, setPreviewState] = useState<{
    output: ConversionOutput;
    originalBytes: number;
    originalBlob: Blob;
  } | null>(null);
  const completedCount = jobs.filter((j) => j.status === 'completed' && j.output?.blob).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {jobs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          {completedCount >= 2 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 42, padding: '8px 14px', fontSize: '0.84rem' }}
              onClick={() => void bundleCompletedAsZip()}
            >
              <Archive size={16} />
              <span>{dict.queue.bundleZip}</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ minHeight: 42, padding: '8px 12px', fontSize: '0.86rem' }}
            onClick={clearCompletedJobs}
          >
            {dict.queue.clearCompleted}
          </button>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
            {dict.queue.emptyTitle}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {dict.queue.emptyDesc}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {jobs.map((job) => {
            const statusText =
              job.status === 'queued'
                ? dict.queue.statusQueued
                : job.status === 'running'
                  ? dict.queue.statusRunning
                  : job.status === 'completed'
                    ? dict.queue.statusCompleted
                    : job.status === 'cancelled'
                      ? dict.queue.statusCancelled
                      : dict.queue.statusFailed;

            const sizeSummary = getSizeSummary(job.file.size, job.output?.sizeBytes);

            return (
              <article
                key={job.id}
                className="card"
                data-testid={`queue-job-${job.status}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        fontWeight: 700,
                        fontSize: '0.96rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {job.status === 'completed' && (
                        <CheckCircle2 size={18} color="var(--green)" style={{ flexShrink: 0 }} />
                      )}
                      <span className="truncate">
                        {middleTruncate(job.output?.fileName ?? job.file.name, 34)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      <span className={sizeSummary.saved ? 'tag tag-local tabular' : 'tag tag-accent tabular'}>
                        {statusText} · {sizeSummary.text}
                      </span>
                      {job.status === 'running' && job.etaSeconds && (
                        <span className="tabular" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {interpolate(dict.queue.etaSeconds, { sec: job.etaSeconds })}
                        </span>
                      )}
                    </div>
                  </div>
                  <PrivacyBadge tier={job.plan.highestTier} compact />
                </div>

                {job.status === 'running' && (
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${job.progress}%` }} />
                  </div>
                )}

                {job.errorMessage && (
                  <div style={{ fontSize: '0.84rem', color: 'var(--red-text)', lineHeight: 1.45 }}>
                    {job.errorMessage}
                    {job.trialRefunded ? ` (${dict.queue.trialRefunded})` : ''}
                  </div>
                )}

                {(job.status === 'running' || job.status === 'queued') && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ width: '100%' }}
                    onClick={() => cancelJob(job.id)}
                  >
                    <X size={16} />
                    <span>{dict.queue.cancel}</span>
                  </button>
                )}

                {job.status === 'completed' && job.output?.blob && (
                  <div className="grid-2">
                    <button
                      type="button"
                      data-testid="queue-preview-btn"
                      className="btn btn-secondary"
                      onClick={() =>
                        setPreviewState({
                          output: job.output!,
                          originalBytes: job.file.size,
                          originalBlob: job.file,
                        })
                      }
                    >
                      <Eye size={17} />
                      <span>{dict.queue.preview}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        void shareOrDownloadOutput(job.output!.blob!, job.output!.fileName)
                      }
                    >
                      <Share2 size={17} />
                      <span>{dict.queue.share}</span>
                    </button>
                  </div>
                )}

                {(job.status === 'failed' || job.status === 'cancelled') && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                    onClick={() => retryJob(job.id)}
                  >
                    <RotateCcw size={16} />
                    <span>{dict.queue.retry}</span>
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <FilePreviewModal
        output={previewState?.output ?? null}
        originalSizeBytes={previewState?.originalBytes}
        originalBlob={previewState?.originalBlob}
        onClose={() => setPreviewState(null)}
      />
    </div>
  );
};

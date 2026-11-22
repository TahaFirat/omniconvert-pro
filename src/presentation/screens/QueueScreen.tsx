import React, { useState } from 'react';
import { Archive, Eye, RotateCcw, Share2, X } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { interpolate } from '../../core/i18n';
import type { ConversionOutput } from '../../domain/entities/job';
import { shareOrDownloadOutput } from '../../infrastructure/native/omniNativeBridge';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { formatFileSize } from '../components/formatBytes';
import { PrivacyBadge } from '../components/PrivacyBadge';

function formatSizeComparison(beforeBytes: number, afterBytes?: number): string {
  if (!afterBytes || afterBytes <= 0) return formatFileSize(beforeBytes);
  const diffPct = Math.round(((beforeBytes - afterBytes) / Math.max(1, beforeBytes)) * 100);
  if (diffPct >= 5) {
    return `${formatFileSize(beforeBytes)} → ${formatFileSize(afterBytes)} (-%${diffPct})`;
  }
  return `${formatFileSize(beforeBytes)} → ${formatFileSize(afterBytes)}`;
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

  const [previewOutput, setPreviewOutput] = useState<ConversionOutput | null>(null);
  const completedCount = jobs.filter((j) => j.status === 'completed' && j.output?.blob).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {jobs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          {completedCount >= 2 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 36, padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => void bundleCompletedAsZip()}
            >
              <Archive size={15} />
              <span>{dict.queue.bundleZip}</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ minHeight: 36, padding: '6px 10px', fontSize: '0.82rem' }}
            onClick={clearCompletedJobs}
          >
            {dict.queue.clearCompleted}
          </button>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '44px 20px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
            {dict.queue.emptyTitle}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            {dict.queue.emptyDesc}
          </p>
        </div>
      ) : (
        <div className="ios-group">
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

            return (
              <article
                key={job.id}
                className="ios-row"
                data-testid={`queue-job-${job.status}`}
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '14px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                      {job.output?.fileName ?? job.file.name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {statusText} • {formatSizeComparison(job.file.size, job.output?.sizeBytes)}
                      {job.status === 'running' && job.etaSeconds
                        ? ` • ${interpolate(dict.queue.etaSeconds, { sec: job.etaSeconds })}`
                        : ''}
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
                  <div style={{ fontSize: '0.78rem', color: 'var(--red-text)' }}>
                    {job.errorMessage}
                    {job.trialRefunded ? ` (${dict.queue.trialRefunded})` : ''}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(job.status === 'running' || job.status === 'queued') && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ minHeight: 34, padding: '6px 12px', fontSize: '0.78rem' }}
                      onClick={() => cancelJob(job.id)}
                    >
                      <X size={14} />
                      <span>{dict.queue.cancel}</span>
                    </button>
                  )}

                  {job.status === 'completed' && job.output?.blob && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ minHeight: 34, padding: '6px 12px', fontSize: '0.78rem' }}
                        onClick={() => setPreviewOutput(job.output!)}
                      >
                        <Eye size={14} />
                        <span>{dict.queue.preview}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ minHeight: 34, padding: '6px 12px', fontSize: '0.78rem' }}
                        onClick={() =>
                          void shareOrDownloadOutput(job.output!.blob!, job.output!.fileName)
                        }
                      >
                        <Share2 size={14} />
                        <span>{dict.queue.share}</span>
                      </button>
                    </>
                  )}

                  {(job.status === 'failed' || job.status === 'cancelled') && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ minHeight: 34, padding: '6px 12px', fontSize: '0.78rem' }}
                      onClick={() => retryJob(job.id)}
                    >
                      <RotateCcw size={14} />
                      <span>{dict.queue.retry}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FilePreviewModal output={previewOutput} onClose={() => setPreviewOutput(null)} />
    </div>
  );
};

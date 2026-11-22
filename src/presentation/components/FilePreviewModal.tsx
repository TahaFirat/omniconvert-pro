import React, { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import type { ConversionOutput } from '../../domain/entities/job';
import { shareOrDownloadOutput } from '../../infrastructure/native/omniNativeBridge';
import { formatFileSize } from './formatBytes';

interface FilePreviewModalProps {
  output: ConversionOutput | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ output, onClose }) => {
  const { dict } = useApp();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!output?.blob) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(output.blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [output]);

  if (!output) return null;

  const isImage = output.mime.startsWith('image/');
  const isAudio = output.mime.startsWith('audio/');
  const isPdf = output.mime === 'application/pdf';
  const hasText = typeof output.previewText === 'string';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dict.preview.title}>
      <div className="modal-sheet">
        <div className="sheet-grabber" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{dict.preview.title}</div>
            <div className="truncate" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {output.fileName} • {formatFileSize(output.sizeBytes)}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: 34, height: 34, minHeight: 34, padding: 0, borderRadius: '50%' }}
            onClick={onClose}
            aria-label={dict.preview.close}
          >
            <X size={17} />
          </button>
        </div>

        <div
          style={{
            borderRadius: 'var(--radius-md)',
            background: 'var(--sheet-card)',
            padding: 12,
            maxHeight: '52dvh',
            overflow: 'auto',
          }}
        >
          {isImage && objectUrl && (
            <img
              src={objectUrl}
              alt={output.fileName}
              style={{ maxWidth: '100%', height: 'auto', borderRadius: 10, display: 'block', margin: '0 auto' }}
            />
          )}
          {isAudio && objectUrl && <audio controls src={objectUrl} style={{ width: '100%' }} />}
          {isPdf && objectUrl && (
            <iframe
              title={output.fileName}
              src={objectUrl}
              style={{ width: '100%', height: 320, border: 'none', borderRadius: 8 }}
            />
          )}
          {hasText && (
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--text-primary)',
              }}
            >
              {output.previewText!.slice(0, 12000)}
            </pre>
          )}
          {!isImage && !isAudio && !isPdf && !hasText && (
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              {dict.preview.noInlinePreview}
            </p>
          )}
        </div>

        {output.blob && (
          <div className="grid-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void shareOrDownloadOutput(output.blob!, output.fileName)}
            >
              <Share2 size={16} />
              <span>{dict.queue.share}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void shareOrDownloadOutput(output.blob!, output.fileName)}
            >
              <Download size={16} />
              <span>{dict.queue.save}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileArchive,
  Maximize2,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { unzipSync } from 'fflate';
import { useApp } from '../../application/AppContext';
import { interpolate } from '../../core/i18n';
import type { ConversionOutput } from '../../domain/entities/job';
import { convertArchiveLocally } from '../../infrastructure/local/localArchiveConverter';
import { convertDataLocally } from '../../infrastructure/local/localDataConverter';
import { renderPdfPageToDataUrl } from '../../infrastructure/local/pdfPreviewEngine';
import {
  isNativeIos,
  openNativeQuickLook,
  shareOrDownloadOutput,
} from '../../infrastructure/native/omniNativeBridge';
import { formatFileSize } from './formatBytes';

export interface PreviewTarget {
  fileName: string;
  mime: string;
  formatId: string;
  sizeBytes: number;
  blob?: Blob;
  previewText?: string;
  originalSizeBytes?: number;
}

interface FilePreviewModalProps {
  output?: ConversionOutput | null;
  target?: PreviewTarget | null;
  originalSizeBytes?: number;
  onClose: () => void;
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv', 'md', 'html', 'htm', 'rtf', 'svg',
]);

function inferExt(fileName: string, formatId?: string): string {
  if (formatId) return formatId.toLowerCase();
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  output,
  target,
  originalSizeBytes,
  onClose,
}) => {
  const { dict, showToast } = useApp();

  const item: PreviewTarget | null = useMemo(() => {
    if (target) return target;
    if (output) {
      return {
        fileName: output.fileName,
        mime: output.mime,
        formatId: output.formatId,
        sizeBytes: output.sizeBytes,
        blob: output.blob,
        previewText: output.previewText,
        originalSizeBytes,
      };
    }
    return null;
  }, [output, target, originalSizeBytes]);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  // PDF multi-page canvas / PDFKit state
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotal, setPdfTotal] = useState(0);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Dynamic text / CSV / DOCX / XLSX / Archive inspection state
  const [resolvedText, setResolvedText] = useState<string | null>(null);
  const [archiveList, setArchiveList] = useState<Array<{ name: string; size: number }> | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);

  const ext = item ? inferExt(item.fileName, item.formatId) : '';
  const isImage = Boolean(item && (item.mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'svg'].includes(ext)));
  const isVideo = Boolean(item && (item.mime.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm'].includes(ext)));
  const isAudio = Boolean(item && (item.mime.startsWith('audio/') || ['m4a', 'm4r', 'wav', 'mp3', 'ogg', 'flac'].includes(ext)));
  const isPdf = Boolean(item && (item.mime === 'application/pdf' || ext === 'pdf'));
  const isArchive = Boolean(item && ['zip'].includes(ext));
  const isRichDoc = Boolean(item && ['docx', 'xlsx', 'ods', 'epub'].includes(ext));
  const isTextLike = Boolean(item && (item.previewText || item.mime.startsWith('text/') || TEXT_EXTENSIONS.has(ext)));

  // Reset per-item state
  useEffect(() => {
    setZoom(1);
    setPdfPage(1);
    setPdfTotal(0);
    setPdfDataUrl(null);
    setPdfError(null);
    setImgDims(null);
    setCopied(false);
    setResolvedText(item?.previewText ?? null);
    setArchiveList(null);
  }, [item]);

  // Manage Blob Object URL for image/video/audio
  useEffect(() => {
    if (!item?.blob || (!isImage && !isVideo && !isAudio)) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(item.blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item, isImage, isVideo, isAudio]);

  // Render PDF page via native Apple PDFKit (iOS) or bundled PDF.js canvas (universal — zero broken iframe!)
  useEffect(() => {
    if (!isPdf || !item?.blob) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);

    void renderPdfPageToDataUrl(item.blob, pdfPage, 1.55)
      .then((res) => {
        if (cancelled) return;
        setPdfDataUrl(res.dataUrl);
        setPdfTotal(res.pageCount);
      })
      .catch((err) => {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : 'PDF preview failed');
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPdf, item, pdfPage]);

  // Auto-load text / DOCX / XLSX / EPUB / ZIP contents for rich preview
  useEffect(() => {
    if (!item?.blob || item.previewText || isPdf || isImage || isVideo || isAudio) return;
    let cancelled = false;

    const loadExtra = async () => {
      setLoadingContent(true);
      try {
        if (isArchive) {
          const bytes = new Uint8Array(await item.blob!.arrayBuffer());
          const unzipped = unzipSync(bytes);
          const entries = Object.entries(unzipped)
            .filter(([name]) => !name.endsWith('/'))
            .slice(0, 120)
            .map(([name, buf]) => ({ name, size: buf.byteLength }));
          if (!cancelled) setArchiveList(entries);
          return;
        }
        if (isRichDoc) {
          if (ext === 'epub') {
            const res = await convertArchiveLocally(item.blob!, item.fileName, 'epub', 'txt');
            if (!cancelled) setResolvedText(res.previewText ?? '');
          } else {
            const targetFmt = ext === 'xlsx' || ext === 'ods' ? 'csv' : 'txt';
            const res = await convertDataLocally(item.blob!, ext, targetFmt);
            if (!cancelled) setResolvedText(res.previewText);
          }
          return;
        }
        if (isTextLike) {
          let txt = await item.blob!.text();
          if (ext === 'json') {
            try {
              txt = JSON.stringify(JSON.parse(txt), null, 2);
            } catch {
              // Keep raw JSON text
            }
          }
          if (!cancelled) setResolvedText(txt);
        }
      } catch {
        // Keep graceful fallback
      } finally {
        if (!cancelled) setLoadingContent(false);
      }
    };

    void loadExtra();
    return () => {
      cancelled = true;
    };
  }, [item, ext, isArchive, isRichDoc, isTextLike, isPdf, isImage, isVideo, isAudio]);

  if (!item) return null;

  const sizeDiffPct =
    item.originalSizeBytes && item.originalSizeBytes > 0
      ? Math.round(((item.originalSizeBytes - item.sizeBytes) / item.originalSizeBytes) * 100)
      : null;

  const handleCopyText = async () => {
    if (!resolvedText) return;
    try {
      await navigator.clipboard.writeText(resolvedText);
      setCopied(true);
      showToast(dict.preview.copied);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast(dict.preview.copied);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={dict.preview.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" style={{ maxWidth: 640 }}>
        <div className="sheet-grabber" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              {dict.preview.title}
            </div>
            <div className="truncate" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {item.fileName} • {formatFileSize(item.sizeBytes)}
              {imgDims ? ` • ${imgDims.w}×${imgDims.h}` : ''}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={dict.preview.close}
          >
            <X size={17} />
          </button>
        </div>

        {/* Before vs After Savings Pill */}
        {item.originalSizeBytes && item.originalSizeBytes > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={sizeDiffPct !== null && sizeDiffPct >= 5 ? 'tag tag-local' : 'tag tag-accent'}>
              {formatFileSize(item.originalSizeBytes)} → {formatFileSize(item.sizeBytes)}
              {sizeDiffPct !== null && sizeDiffPct >= 5 ? ` (-%${sizeDiffPct})` : ''}
            </span>
          </div>
        )}

        {/* PDF Multi-Page & Zoom Controls */}
        {isPdf && pdfTotal > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--sheet-card)',
              border: '0.5px solid var(--separator)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="icon-btn"
                disabled={pdfPage <= 1 || pdfLoading}
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {interpolate(dict.preview.pageOf, { page: pdfPage, total: pdfTotal })}
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={pdfPage >= pdfTotal || pdfLoading}
                onClick={() => setPdfPage((p) => Math.min(pdfTotal, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="icon-btn"
                disabled={zoom <= 0.75}
                onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                aria-label="Zoom out"
              >
                <ZoomOut size={15} />
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 40, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={zoom >= 2.25}
                onClick={() => setZoom((z) => Math.min(2.25, +(z + 0.25).toFixed(2)))}
                aria-label="Zoom in"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Preview Stage */}
        <div
          className={isImage ? 'preview-checkerboard' : undefined}
          style={{
            borderRadius: 'var(--radius-md)',
            background: isImage ? undefined : 'var(--sheet-card)',
            border: '0.5px solid var(--separator)',
            padding: isPdf || isImage ? 10 : 14,
            maxHeight: '52dvh',
            minHeight: 140,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Image */}
          {isImage && objectUrl && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                src={objectUrl}
                alt={item.fileName}
                onLoad={(e) =>
                  setImgDims({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                style={{
                  width: `${Math.round(zoom * 100)}%`,
                  maxWidth: zoom <= 1 ? '100%' : 'none',
                  height: 'auto',
                  borderRadius: 10,
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Video */}
          {isVideo && objectUrl && (
            <video
              controls
              playsInline
              preload="metadata"
              src={objectUrl}
              style={{
                width: '100%',
                maxHeight: '44dvh',
                borderRadius: 10,
                background: '#000000',
                display: 'block',
              }}
            />
          )}

          {/* Audio */}
          {isAudio && objectUrl && (
            <div style={{ padding: '16px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {item.fileName}
              </div>
              <audio controls src={objectUrl} style={{ width: '100%' }} />
            </div>
          )}

          {/* Multi-Page PDF Rendered Image (Zero Broken Iframe!) */}
          {isPdf && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {pdfLoading && !pdfDataUrl && (
                <div style={{ padding: 28, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  {dict.preview.loading}
                </div>
              )}
              {pdfDataUrl && (
                <img
                  src={pdfDataUrl}
                  alt={`${item.fileName} - ${pdfPage}`}
                  style={{
                    width: `${Math.round(zoom * 100)}%`,
                    maxWidth: zoom <= 1 ? '100%' : 'none',
                    height: 'auto',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
                    opacity: pdfLoading ? 0.6 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                />
              )}
              {pdfError && (
                <div style={{ padding: 16, fontSize: '0.84rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {dict.preview.noInlinePreview}
                </div>
              )}
            </div>
          )}

          {/* Archive Contents List */}
          {isArchive && archiveList && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <FileArchive size={16} color="var(--accent)" />
                <span>{interpolate(dict.preview.archiveItems, { count: archiveList.length })}</span>
              </div>
              <div className="ios-group">
                {archiveList.map((entry) => (
                  <div key={entry.name} className="ios-row" style={{ minHeight: 40, padding: '8px 12px' }}>
                    <span className="truncate" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', flex: 1 }}>
                      {entry.name}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatFileSize(entry.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text / JSON / CSV / DOCX / XLSX / EPUB / Markdown */}
          {!isPdf && !isImage && !isVideo && !isAudio && !archiveList && resolvedText !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: 32, padding: '5px 12px', fontSize: '0.78rem' }}
                  onClick={() => void handleCopyText()}
                >
                  {copied ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
                  <span>{copied ? dict.preview.copied : dict.preview.copyText}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--text-primary)',
                }}
              >
                {resolvedText.slice(0, 18000)}
              </pre>
            </div>
          )}

          {/* Loading or Unsupported Fallback */}
          {loadingContent && !resolvedText && !archiveList && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              {dict.preview.loading}
            </div>
          )}

          {!loadingContent && !isImage && !isVideo && !isAudio && !isPdf && !archiveList && resolvedText === null && (
            <p style={{ margin: 0, padding: 12, fontSize: '0.86rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {dict.preview.noInlinePreview}
            </p>
          )}
        </div>

        {/* Native iOS QuickLook Full-Screen Button */}
        {isNativeIos() && item.blob && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={() => void openNativeQuickLook(item.blob!, item.fileName)}
          >
            <Maximize2 size={16} />
            <span>{dict.preview.quickLook}</span>
          </button>
        )}

        {/* Share & Save */}
        {item.blob && (
          <div className="grid-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void shareOrDownloadOutput(item.blob!, item.fileName)}
            >
              <Share2 size={16} />
              <span>{dict.queue.share}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void shareOrDownloadOutput(item.blob!, item.fileName)}
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

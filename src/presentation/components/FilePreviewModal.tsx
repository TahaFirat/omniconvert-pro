import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileArchive,
  Maximize2,
  Moon,
  Share2,
  Sun,
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
import { formatFileSize, middleTruncate } from './formatBytes';

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
  const [pdfDarkStage, setPdfDarkStage] = useState(true);

  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotal, setPdfTotal] = useState(0);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [resolvedText, setResolvedText] = useState<string | null>(null);
  const [archiveList, setArchiveList] = useState<Array<{ name: string; size: number }> | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);

  const ext = item ? inferExt(item.fileName, item.formatId) : '';
  const isImage = Boolean(
    item &&
      (item.mime.startsWith('image/') ||
        ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'svg'].includes(ext)),
  );
  const isVideo = Boolean(
    item && (item.mime.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm'].includes(ext)),
  );
  const isAudio = Boolean(
    item && (item.mime.startsWith('audio/') || ['m4a', 'm4r', 'wav', 'mp3', 'ogg', 'flac'].includes(ext)),
  );
  const isPdf = Boolean(item && (item.mime === 'application/pdf' || ext === 'pdf'));
  const isArchive = Boolean(item && ext === 'zip');
  const isRichDoc = Boolean(item && ['docx', 'xlsx', 'ods', 'epub'].includes(ext));
  const isTextLike = Boolean(
    item && (item.previewText || item.mime.startsWith('text/') || TEXT_EXTENSIONS.has(ext)),
  );

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

  useEffect(() => {
    if (!item?.blob || (!isImage && !isVideo && !isAudio)) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(item.blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item, isImage, isVideo, isAudio]);

  useEffect(() => {
    if (!isPdf || !item?.blob) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);

    void renderPdfPageToDataUrl(item.blob, pdfPage, 1.75)
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
            .slice(0, 150)
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
              // Keep raw JSON
            }
          }
          if (!cancelled) setResolvedText(txt);
        }
      } catch {
        // Fallback handled in UI
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
      className="fullscreen-view fullscreen-view--preview"
      role="dialog"
      aria-modal="true"
      aria-label={dict.preview.title}
    >
      {/* 1. Sticky Native iOS Top Navigation Bar (44x44pt Controls) */}
      <header className="fullscreen-header">
        <div className="fullscreen-header-inner">
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={dict.preview.close}
            data-testid="preview-close-btn"
          >
            <X size={20} />
          </button>

          <div style={{ minWidth: 0, flex: 1, textAlign: 'center', padding: '0 4px' }}>
            <div
              className="truncate"
              style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}
            >
              {middleTruncate(item.fileName, 28)}
            </div>
            <div
              className="truncate tabular"
              style={{
                fontSize: '0.74rem',
                color: sizeDiffPct !== null && sizeDiffPct >= 5 ? 'var(--green-text)' : 'var(--text-muted)',
                fontWeight: sizeDiffPct !== null && sizeDiffPct >= 5 ? 600 : 400,
                marginTop: 1,
              }}
            >
              {item.originalSizeBytes && item.originalSizeBytes > 0
                ? `${formatFileSize(item.originalSizeBytes)} → ${formatFileSize(item.sizeBytes)}${
                    sizeDiffPct !== null && sizeDiffPct >= 5 ? ` (-%${sizeDiffPct})` : ''
                  }`
                : `${formatFileSize(item.sizeBytes)}${imgDims ? ` · ${imgDims.w}×${imgDims.h}` : ''}`}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {isPdf && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPdfDarkStage((v) => !v)}
                aria-label="Toggle reading background"
              >
                {pdfDarkStage ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}
            {resolvedText !== null && !isPdf && !isImage && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => void handleCopyText()}
                aria-label={dict.preview.copyText}
              >
                {copied ? <Check size={18} color="var(--green)" /> : <Copy size={18} />}
              </button>
            )}
            {item.blob && (
              <button
                type="button"
                className="icon-btn"
                style={{ background: 'var(--accent)', color: '#FFFFFF' }}
                onClick={() => void shareOrDownloadOutput(item.blob!, item.fileName)}
                aria-label={dict.queue.share}
              >
                <Share2 size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Full-Bleed Spacious Preview Canvas (~80% Viewport Height!) */}
      <div
        className={`fullscreen-body${isImage ? ' preview-checkerboard' : ''}`}
        style={{
          background: isPdf
            ? pdfDarkStage
              ? '#101014'
              : '#E4E4EA'
            : isImage
              ? undefined
              : 'var(--bg-app)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex: 1,
            width: '100%',
            maxWidth: isPdf || isImage ? 920 : 720,
            margin: '0 auto',
            padding: isPdf || isImage ? '16px 14px 24px 14px' : '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isPdf || isImage || isVideo ? 'center' : 'stretch',
            justifyContent: isImage || isVideo || isAudio ? 'center' : 'flex-start',
          }}
        >
          {/* Image Full-Screen Viewer */}
          {isImage && objectUrl && (
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
                width: zoom === 1 ? 'auto' : `${Math.round(zoom * 100)}%`,
                maxWidth: zoom <= 1 ? '100%' : 'none',
                maxHeight: zoom <= 1 ? '72dvh' : 'none',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 12,
                boxShadow: '0 8px 30px rgba(0,0,0,0.28)',
              }}
            />
          )}

          {/* Video Full-Screen Inline Player */}
          {isVideo && objectUrl && (
            <video
              controls
              playsInline
              preload="metadata"
              src={objectUrl}
              style={{
                width: '100%',
                maxHeight: '72dvh',
                borderRadius: 14,
                background: '#000000',
              }}
            />
          )}

          {/* Audio Player Card */}
          {isAudio && objectUrl && (
            <div className="card" style={{ width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {item.fileName}
              </div>
              <audio controls src={objectUrl} style={{ width: '100%' }} />
            </div>
          )}

          {/* Multi-Page PDF Canvas / PDFKit Full-Bleed Viewer */}
          {isPdf && (
            <>
              {pdfLoading && !pdfDataUrl && (
                <div style={{ padding: 48, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
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
                    background: '#FFFFFF',
                    boxShadow: '0 10px 34px rgba(0,0,0,0.34)',
                    opacity: pdfLoading ? 0.65 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                />
              )}
              {pdfError && (
                <div className="card" style={{ marginTop: 24, textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {dict.preview.noInlinePreview}
                </div>
              )}
            </>
          )}

          {/* Archive Contents Explorer */}
          {isArchive && archiveList && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <FileArchive size={18} color="var(--accent)" />
                <span>{interpolate(dict.preview.archiveItems, { count: archiveList.length })}</span>
              </div>
              <div className="ios-group">
                {archiveList.map((entry) => (
                  <div key={entry.name} className="ios-row">
                    <span className="truncate" style={{ fontSize: '0.88rem', color: 'var(--text-primary)', flex: 1 }}>
                      {entry.name}
                    </span>
                    <span className="tabular" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatFileSize(entry.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spacious Full-Height Text / Code / DOCX / XLSX / EPUB Reader */}
          {!isPdf && !isImage && !isVideo && !isAudio && !archiveList && resolvedText !== null && (
            <div className="card" style={{ padding: 18 }}>
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.86rem',
                  lineHeight: 1.62,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--text-primary)',
                }}
              >
                {resolvedText.slice(0, 24000)}
              </pre>
            </div>
          )}

          {loadingContent && !resolvedText && !archiveList && (
            <div style={{ padding: 48, textAlign: 'center', fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              {dict.preview.loading}
            </div>
          )}

          {!loadingContent && !isImage && !isVideo && !isAudio && !isPdf && !archiveList && resolvedText === null && (
            <div className="card" style={{ marginTop: 24, textAlign: 'center', padding: 24 }}>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {dict.preview.noInlinePreview}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Spacious Docked Bottom Controls & Actions Bar (44px+ Tap Targets, >=12px Spacing) */}
      <footer className="fullscreen-footer">
        <div className="fullscreen-footer-inner">
          {/* PDF Page Navigator + Zoom Controls */}
          {isPdf && pdfTotal > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={pdfPage <= 1 || pdfLoading}
                  onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={20} />
                </button>
                <span
                  className="tabular"
                  style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                >
                  {interpolate(dict.preview.pageOf, { page: pdfPage, total: pdfTotal })}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={pdfPage >= pdfTotal || pdfLoading}
                  onClick={() => setPdfPage((p) => Math.min(pdfTotal, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={zoom <= 0.75}
                  onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                  aria-label="Zoom out"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="tabular" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 44, textAlign: 'center' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={zoom >= 2.25}
                  onClick={() => setZoom((z) => Math.min(2.25, +(z + 0.25).toFixed(2)))}
                  aria-label="Zoom in"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Image Zoom Controls */}
          {isImage && objectUrl && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <button
                type="button"
                className="icon-btn"
                disabled={zoom <= 0.75}
                onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                aria-label="Zoom out"
              >
                <ZoomOut size={18} />
              </button>
              <span className="tabular" style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: 50, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={zoom >= 2.5}
                onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                aria-label="Zoom in"
              >
                <ZoomIn size={18} />
              </button>
            </div>
          )}

          {/* Native iOS QuickLook Full-Screen Button */}
          {isNativeIos() && item.blob && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => void openNativeQuickLook(item.blob!, item.fileName)}
            >
              <Maximize2 size={18} />
              <span>{dict.preview.quickLook}</span>
            </button>
          )}

          {/* Primary Share & Save Actions */}
          {item.blob && (
            <div className="grid-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void shareOrDownloadOutput(item.blob!, item.fileName)}
              >
                <Share2 size={18} />
                <span>{dict.queue.share}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void shareOrDownloadOutput(item.blob!, item.fileName)}
              >
                <Download size={18} />
                <span>{dict.queue.save}</span>
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

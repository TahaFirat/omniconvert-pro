import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  ClipboardPaste,
  Eye,
  FileArchive,
  FilePlus2,
  FileText,
  Film,
  Image as ImageIcon,
  Layers,
  Music,
  ScanText,
  Scissors,
  X,
} from 'lucide-react';
import { useApp, type SelectedInputItem } from '../../application/AppContext';
import { interpolate } from '../../core/i18n';
import type { ConversionOptions } from '../../domain/entities/job';
import {
  GUIDED_TOOLS,
  type GuidedToolId,
  type ToolCategory,
} from '../../domain/tools/toolCatalog';
import { readClipboardContent } from '../../infrastructure/native/omniNativeBridge';
import { FilePreviewModal, type PreviewTarget } from '../components/FilePreviewModal';
import { formatFileSize } from '../components/formatBytes';
import { ToolWorkspaceSheet } from './ToolWorkspaceSheet';

function renderToolIcon(toolId: GuidedToolId) {
  switch (toolId) {
    case 'pdf-merge':
      return <Layers size={20} strokeWidth={2} />;
    case 'images-to-pdf':
      return <FileText size={20} strokeWidth={2} />;
    case 'pdf-tools':
      return <Scissors size={20} strokeWidth={2} />;
    case 'image-convert':
      return <ImageIcon size={20} strokeWidth={2} />;
    case 'video-audio':
      return <Music size={20} strokeWidth={2} />;
    case 'video-compress':
      return <Film size={20} strokeWidth={2} />;
    case 'ocr-extract':
      return <ScanText size={20} strokeWidth={2} />;
    default:
      return <FileArchive size={20} strokeWidth={2} />;
  }
}

export const ConvertScreen: React.FC = () => {
  const {
    dict,
    selectedInputs,
    addFiles,
    removeSelectedInput,
    moveSelectedInput,
    clearSelectedInputs,
    pendingPresetLaunch,
    consumePendingPresetLaunch,
    showToast,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [category, setCategory] = useState<ToolCategory>('all');
  const [activeWorkspace, setActiveWorkspace] = useState<{
    toolId: GuidedToolId;
    target?: string;
    options?: Partial<ConversionOptions>;
  } | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewTarget | null>(null);

  // If user tapped "Use" on a saved custom preset in History, launch workspace with it immediately
  useEffect(() => {
    if (!pendingPresetLaunch) return;
    setActiveWorkspace({
      toolId: 'universal',
      target: pendingPresetLaunch.targetFormat,
      options: pendingPresetLaunch.options,
    });
    consumePendingPresetLaunch();
  }, [pendingPresetLaunch, consumePendingPresetLaunch]);

  const visibleTools = useMemo(() => {
    if (category === 'all') return GUIDED_TOOLS;
    return GUIDED_TOOLS.filter((t) => t.category === category);
  }, [category]);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (list.length > 0) {
      await addFiles(list);
    }
  };

  const handlePasteClipboard = async () => {
    const { text } = await readClipboardContent();
    if (!text) {
      showToast(dict.convert.pasteEmpty);
      return;
    }
    const trimmed = text.trim();
    const isJson = trimmed.startsWith('{') || trimmed.startsWith('[');
    const file = new File(
      [text],
      isJson ? `pano_${Date.now()}.json` : `pano_${Date.now()}.txt`,
      { type: isJson ? 'application/json' : 'text/plain' },
    );
    await addFiles([file]);
    showToast(dict.convert.pasteSuccess);
  };

  const openInputPreview = (item: SelectedInputItem) => {
    setPreviewItem({
      fileName: item.file.name,
      mime: item.file.type || 'application/octet-stream',
      formatId: item.inspection.detectedFormatId,
      sizeBytes: item.file.size,
      blob: item.file,
    });
  };

  const categories: Array<{ id: ToolCategory; label: string }> = [
    { id: 'all', label: dict.convert.catAll },
    { id: 'pdf', label: dict.convert.catPdf },
    { id: 'image', label: dict.convert.catImage },
    { id: 'media', label: dict.convert.catMedia },
    { id: 'doc', label: dict.convert.catDoc },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <input
        ref={fileInputRef}
        data-testid="file-input"
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => void handleFileInputChange(e)}
      />
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => void handleFileInputChange(e)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => void handleFileInputChange(e)}
      />

      {/* 1. Primary Universal Picker Surface */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          data-testid="pick-files-btn"
          onClick={() => fileInputRef.current?.click()}
          className="card"
          style={{
            width: '100%',
            padding: '22px 18px',
            border: '1px dashed var(--separator-strong)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FilePlus2 size={24} strokeWidth={1.9} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {dict.convert.dropTitle}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.35 }}>
              {dict.convert.dropSubtitle}
            </div>
          </div>
        </button>

        {/* Clean 3-Source Action Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="card"
            style={{
              padding: '11px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <ImageIcon size={17} strokeWidth={1.9} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span className="truncate">{dict.convert.pickMedia}</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="card"
            style={{
              padding: '11px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <Camera size={17} strokeWidth={1.9} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span className="truncate">{dict.convert.scanCamera}</span>
          </button>

          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            className="card"
            style={{
              padding: '11px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <ClipboardPaste size={17} strokeWidth={1.9} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span className="truncate">{dict.convert.pasteClipboard}</span>
          </button>
        </div>
      </section>

      {/* 2. Selected Files (with Instant Preview & Reorder) */}
      {selectedInputs.length > 0 && (
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 6px 8px 6px',
              gap: 8,
            }}
          >
            <span className="section-header" style={{ padding: 0, margin: 0 }}>
              {dict.convert.selectedFiles} ({selectedInputs.length})
            </span>
            <div style={{ display: 'flex', gap: 14 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  color: 'var(--accent)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                {dict.convert.addMore}
              </button>
              <button
                type="button"
                onClick={clearSelectedInputs}
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                {dict.convert.clearSelection}
              </button>
            </div>
          </div>

          <div className="ios-group">
            {selectedInputs.map((item, idx) => (
              <div key={item.id} className="ios-row" style={{ gap: 10 }}>
                {item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt={item.file.name}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9,
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '0.5px solid var(--separator)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--bg-fill)',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      flexShrink: 0,
                    }}
                  >
                    {item.inspection.detectedFormatId.toUpperCase().slice(0, 4)}
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="truncate" style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {item.file.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {formatFileSize(item.file.size)}
                      {item.pageCount ? ` • ${interpolate(dict.convert.pagesLabel, { count: item.pageCount })}` : ''}
                    </span>
                    {item.inspection.isExtensionMismatch && (
                      <span className="tag tag-warn">.{item.inspection.detectedFormatId.toUpperCase()}</span>
                    )}
                    {item.inspection.isEncrypted && (
                      <span className="tag tag-danger">{dict.convert.encryptedHint}</span>
                    )}
                    {item.inspection.hasDrm && (
                      <span className="tag tag-danger">{dict.convert.drmHint}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={dict.queue.preview}
                    onClick={() => openInputPreview(item)}
                    style={{ width: 30, height: 30, minWidth: 30, minHeight: 30 }}
                  >
                    <Eye size={14} />
                  </button>
                  {selectedInputs.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Move up"
                        disabled={idx === 0}
                        onClick={() => moveSelectedInput(item.id, 'up')}
                        style={{ width: 28, height: 28, minWidth: 28, minHeight: 28 }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Move down"
                        disabled={idx === selectedInputs.length - 1}
                        onClick={() => moveSelectedInput(item.id, 'down')}
                        style={{ width: 28, height: 28, minWidth: 28, minHeight: 28 }}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Remove"
                    onClick={() => removeSelectedInput(item.id)}
                    style={{ width: 28, height: 28, minWidth: 28, minHeight: 28 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            data-testid="choose-target-btn"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => setActiveWorkspace({ toolId: 'universal' })}
          >
            {selectedInputs.length === 1
              ? dict.convert.chooseTarget
              : interpolate(dict.convert.convertCount, { count: selectedInputs.length })}
          </button>
        </section>
      )}

      {/* 3. Zero-Confusion Guided Tool Grid (iLovePDF + Media Converter inspired) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="pill-strip" role="tablist" aria-label={dict.convert.presetsTitle}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={category === cat.id}
              className={`filter-pill${category === cat.id ? ' is-active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="tools-grid">
          {visibleTools.map((tool) => {
            const copy = dict.tools[tool.copyKey];
            return (
              <button
                key={tool.id}
                type="button"
                data-testid={`tool-card-${tool.id}`}
                className="tool-card"
                onClick={() => setActiveWorkspace({ toolId: tool.id })}
              >
                <div
                  className="tool-icon-box"
                  style={{ background: tool.accentBg, color: tool.accentColor }}
                >
                  {renderToolIcon(tool.id)}
                </div>
                <div style={{ minWidth: 0, width: '100%' }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      lineHeight: 1.25,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {copy.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.76rem',
                      lineHeight: 1.35,
                      color: 'var(--text-muted)',
                      marginTop: 4,
                    }}
                  >
                    {copy.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {activeWorkspace && (
        <ToolWorkspaceSheet
          toolId={activeWorkspace.toolId}
          initialTarget={activeWorkspace.target}
          initialOptions={activeWorkspace.options}
          onClose={() => setActiveWorkspace(null)}
        />
      )}

      <FilePreviewModal target={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
};

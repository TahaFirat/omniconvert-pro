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
  Trash2,
} from 'lucide-react';
import { useApp, type SelectedInputItem } from '../../application/AppContext';
import { interpolate } from '../../core/i18n';
import {
  GUIDED_TOOLS,
  type GuidedToolId,
  type ToolCategory,
} from '../../domain/tools/toolCatalog';
import { readClipboardContent } from '../../infrastructure/native/omniNativeBridge';
import { FilePreviewModal, type PreviewTarget } from '../components/FilePreviewModal';
import { formatFileSize, middleTruncate } from '../components/formatBytes';

function renderToolIcon(toolId: GuidedToolId) {
  switch (toolId) {
    case 'pdf-merge':
      return <Layers size={21} strokeWidth={2} />;
    case 'images-to-pdf':
      return <FileText size={21} strokeWidth={2} />;
    case 'pdf-tools':
      return <Scissors size={21} strokeWidth={2} />;
    case 'image-convert':
      return <ImageIcon size={21} strokeWidth={2} />;
    case 'video-audio':
      return <Music size={21} strokeWidth={2} />;
    case 'video-compress':
      return <Film size={21} strokeWidth={2} />;
    case 'ocr-extract':
      return <ScanText size={21} strokeWidth={2} />;
    default:
      return <FileArchive size={21} strokeWidth={2} />;
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
    openWorkspace,
    showToast,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [category, setCategory] = useState<ToolCategory>('all');
  const [previewItem, setPreviewItem] = useState<PreviewTarget | null>(null);

  useEffect(() => {
    if (!pendingPresetLaunch) return;
    openWorkspace({
      toolId: 'universal',
      target: pendingPresetLaunch.targetFormat,
      options: pendingPresetLaunch.options,
    });
    consumePendingPresetLaunch();
  }, [pendingPresetLaunch, consumePendingPresetLaunch, openWorkspace]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button"
          data-testid="pick-files-btn"
          onClick={() => fileInputRef.current?.click()}
          className="card"
          style={{
            width: '100%',
            padding: '20px 18px',
            border: '1.5px dashed var(--separator-strong)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FilePlus2 size={24} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {dict.convert.dropTitle}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.38 }}>
              {dict.convert.dropSubtitle}
            </div>
          </div>
        </button>

        {/* Clean 3-Source Strip (Comfortable 50px Height) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="card"
            style={{
              minHeight: 50,
              padding: '10px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: '0.84rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <ImageIcon size={18} strokeWidth={1.9} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span className="truncate">{dict.convert.pickMedia}</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="card"
            style={{
              minHeight: 50,
              padding: '10px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: '0.84rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <Camera size={18} strokeWidth={1.9} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span className="truncate">{dict.convert.scanCamera}</span>
          </button>

          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            className="card"
            style={{
              minHeight: 50,
              padding: '10px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: '0.84rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <ClipboardPaste size={18} strokeWidth={1.9} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span className="truncate">{dict.convert.pasteClipboard}</span>
          </button>
        </div>
      </section>

      {/* 2. Selected Files (Spacious File Cards — Zero Cramming!) */}
      {selectedInputs.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 4px',
              gap: 10,
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
                  minHeight: 36,
                  padding: '4px 6px',
                  color: 'var(--accent)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              >
                {dict.convert.addMore}
              </button>
              <button
                type="button"
                onClick={clearSelectedInputs}
                style={{
                  minHeight: 36,
                  padding: '4px 6px',
                  color: 'var(--text-muted)',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                }}
              >
                {dict.convert.clearSelection}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedInputs.map((item, idx) => (
              <div key={item.id} className="file-item-card">
                <div className="file-item-main">
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {item.thumbUrl ? (
                      <img
                        src={item.thumbUrl}
                        alt={item.file.name}
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 10,
                          objectFit: 'cover',
                          display: 'block',
                          border: '0.5px solid var(--separator)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 10,
                          background: 'var(--bg-fill)',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                        }}
                      >
                        {item.inspection.detectedFormatId.toUpperCase().slice(0, 4)}
                      </div>
                    )}
                    {selectedInputs.length > 1 && (
                      <span
                        className="tabular"
                        style={{
                          position: 'absolute',
                          top: -6,
                          left: -6,
                          width: 21,
                          height: 21,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          color: '#FFFFFF',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.94rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {middleTruncate(item.file.name, 34)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                      <span className="tabular" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatFileSize(item.file.size)}
                        {item.pageCount
                          ? ` · ${interpolate(dict.convert.pagesLabel, { count: item.pageCount })}`
                          : ''}
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
                </div>

                <div
                  className={`file-item-actions${
                    selectedInputs.length === 1 ? ' file-item-actions--two' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="file-action-pill"
                    onClick={() => openInputPreview(item)}
                  >
                    <Eye size={15} />
                    <span>{dict.queue.preview}</span>
                  </button>
                  {selectedInputs.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="file-action-pill"
                        disabled={idx === 0}
                        onClick={() => moveSelectedInput(item.id, 'up')}
                        aria-label="Move up"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="file-action-pill"
                        disabled={idx === selectedInputs.length - 1}
                        onClick={() => moveSelectedInput(item.id, 'down')}
                        aria-label="Move down"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="file-action-pill file-action-pill--danger"
                    onClick={() => removeSelectedInput(item.id)}
                    aria-label={dict.history.deletePreset}
                  >
                    <Trash2 size={15} />
                    {selectedInputs.length === 1 && <span>{dict.history.deletePreset}</span>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Spacious 2-Column Guided Tool Grid */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                onClick={() => openWorkspace({ toolId: tool.id })}
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
                      fontSize: '0.96rem',
                      lineHeight: 1.25,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {copy.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      lineHeight: 1.38,
                      color: 'var(--text-muted)',
                      marginTop: 5,
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

      <FilePreviewModal target={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
};

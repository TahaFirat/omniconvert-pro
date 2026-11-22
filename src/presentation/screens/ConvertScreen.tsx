import React, { useRef, useState } from 'react';
import {
  Camera,
  ChevronRight,
  ClipboardPaste,
  FilePlus2,
  FileText,
  Film,
  Image as ImageIcon,
  Layers,
  Music,
  ScanText,
  X,
} from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { interpolate } from '../../core/i18n';
import type { ConversionOptions } from '../../domain/entities/job';
import type { ConversionPreset } from '../../domain/entities/preset';
import { BUILT_IN_PRESETS } from '../../domain/presets/builtInPresets';
import { readClipboardContent } from '../../infrastructure/native/omniNativeBridge';
import { formatFileSize } from '../components/formatBytes';
import { TargetPickerSheet } from './TargetPickerSheet';

function getPresetIcon(presetId: string) {
  switch (presetId) {
    case 'preset_whatsapp_shrink':
      return <ImageIcon size={18} strokeWidth={1.9} />;
    case 'preset_edevlet_pdf':
      return <FileText size={18} strokeWidth={1.9} />;
    case 'preset_pdf_studio':
      return <Layers size={18} strokeWidth={1.9} />;
    case 'preset_video_audio':
      return <Music size={18} strokeWidth={1.9} />;
    case 'preset_video_gif':
      return <Film size={18} strokeWidth={1.9} />;
    default:
      return <ScanText size={18} strokeWidth={1.9} />;
  }
}

export const ConvertScreen: React.FC = () => {
  const {
    dict,
    selectedInputs,
    addFiles,
    removeSelectedInput,
    clearSelectedInputs,
    showToast,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [presetTarget, setPresetTarget] = useState<string | undefined>(undefined);
  const [presetOptions, setPresetOptions] = useState<Partial<ConversionOptions> | undefined>(
    undefined,
  );

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

  const handleApplyBuiltInPreset = (preset: ConversionPreset) => {
    setPresetTarget(preset.targetFormat);
    setPresetOptions(preset.options);
    if (selectedInputs.length > 0) {
      setPickerOpen(true);
    } else if (preset.id === 'preset_video_audio' || preset.id === 'preset_video_gif') {
      mediaInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
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

      {/* Primary Picker Surface */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          data-testid="pick-files-btn"
          onClick={() => fileInputRef.current?.click()}
          className="card"
          style={{
            width: '100%',
            padding: '28px 20px',
            border: '1px dashed var(--separator-strong)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FilePlus2 size={24} strokeWidth={1.9} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {dict.convert.dropTitle}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {dict.convert.dropSubtitle}
            </div>
          </div>
        </button>

        {/* Compact 3-Column Strip */}
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
              padding: '12px 8px',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            <ImageIcon size={19} strokeWidth={1.8} color="var(--accent)" />
            <span className="truncate">{dict.convert.pickMedia}</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="card"
            style={{
              padding: '12px 8px',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            <Camera size={19} strokeWidth={1.8} color="var(--accent)" />
            <span className="truncate">{dict.convert.scanCamera}</span>
          </button>

          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            className="card"
            style={{
              padding: '12px 8px',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            <ClipboardPaste size={19} strokeWidth={1.8} color="var(--accent)" />
            <span className="truncate">{dict.convert.pasteClipboard}</span>
          </button>
        </div>
      </section>

      {/* Selected Files */}
      {selectedInputs.length > 0 && (
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 14px 8px 14px',
            }}
          >
            <span className="section-header" style={{ padding: 0, margin: 0 }}>
              {dict.convert.selectedFiles} ({selectedInputs.length})
            </span>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: '0.8rem',
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
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                {dict.convert.clearSelection}
              </button>
            </div>
          </div>

          <div className="ios-group">
            {selectedInputs.map((item) => (
              <div key={item.id} className="ios-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: 'var(--bg-fill)',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.68rem',
                      letterSpacing: '0.02em',
                      flexShrink: 0,
                    }}
                  >
                    {item.inspection.detectedFormatId.toUpperCase().slice(0, 4)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontWeight: 500, fontSize: '0.92rem' }}>
                      {item.file.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {formatFileSize(item.file.size)}
                      </span>
                      {item.inspection.isExtensionMismatch && (
                        <span className="tag tag-warn">
                          .{item.inspection.detectedFormatId.toUpperCase()}
                        </span>
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
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => removeSelectedInput(item.id)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--bg-fill)',
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            data-testid="choose-target-btn"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => {
              setPresetTarget(undefined);
              setPresetOptions(undefined);
              setPickerOpen(true);
            }}
          >
            {selectedInputs.length === 1
              ? dict.convert.chooseTarget
              : interpolate(dict.convert.convertCount, { count: selectedInputs.length })}
          </button>
        </section>
      )}

      {/* Quick Tools (Inset Grouped) */}
      <section>
        <h2 className="section-header">{dict.convert.presetsTitle}</h2>
        <div className="ios-group">
          {BUILT_IN_PRESETS.map((preset) => {
            const copy = preset.nameKey ? dict.presets[preset.nameKey] : null;
            return (
              <button
                key={preset.id}
                type="button"
                className="ios-row ios-row-interactive"
                onClick={() => handleApplyBuiltInPreset(preset)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getPresetIcon(preset.id)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontWeight: 500, fontSize: '0.92rem' }}>
                      {copy?.name ?? preset.customName}
                    </div>
                    <div className="truncate" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 1 }}>
                      {copy?.desc ?? preset.description}
                    </div>
                  </div>
                </div>
                <ChevronRight size={17} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </section>

      {pickerOpen && selectedInputs.length > 0 && (
        <TargetPickerSheet
          inputs={selectedInputs}
          initialTarget={presetTarget}
          initialOptions={presetOptions}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};

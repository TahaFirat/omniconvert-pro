import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  FilePlus2,
  Lock,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useApp, type SelectedInputItem } from '../../application/AppContext';
import { getRemainingDailyProTrials, isProFeatureJob } from '../../application/billingService';
import { APP_CONFIG } from '../../core/constants';
import { interpolate } from '../../core/i18n';
import {
  DEFAULT_CONVERSION_OPTIONS,
  type ConversionOptions,
  type ConversionPlan,
} from '../../domain/entities/job';
import { conversionGraph } from '../../domain/graph/conversionGraph';
import { getGuidedTool, type GuidedToolId } from '../../domain/tools/toolCatalog';
import { FilePreviewModal, type PreviewTarget } from '../components/FilePreviewModal';
import { formatFileSize } from '../components/formatBytes';
import { IosSwitch } from '../components/IosSwitch';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { WarningCard } from '../components/WarningCard';

interface ToolWorkspaceSheetProps {
  toolId: GuidedToolId;
  initialTarget?: string;
  initialOptions?: Partial<ConversionOptions>;
  onClose: () => void;
}

const MERGEABLE_FORMATS = new Set(['pdf', 'png', 'jpg', 'webp', 'bmp', 'heic', 'heif', 'tiff', 'svg']);

export const ToolWorkspaceSheet: React.FC<ToolWorkspaceSheetProps> = ({
  toolId,
  initialTarget,
  initialOptions,
  onClose,
}) => {
  const {
    settings,
    dict,
    entitlements,
    selectedInputs,
    addFiles,
    removeSelectedInput,
    moveSelectedInput,
    enqueueAndRun,
    saveCustomPreset,
  } = useApp();

  const toolSpec = getGuidedTool(toolId);
  const toolCopy = toolSpec ? dict.tools[toolSpec.copyKey] : null;
  const primary = selectedInputs[0];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string>(
    initialTarget ?? toolSpec?.defaultTarget ?? '',
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [options, setOptions] = useState<ConversionOptions>(() => ({
    ...DEFAULT_CONVERSION_OPTIONS,
    stripExif: settings.defaultStripExif,
    mergeIntoSinglePdf: toolId === 'pdf-merge' || toolId === 'images-to-pdf',
    ...toolSpec?.defaultOptions,
    ...initialOptions,
  }));
  const [tempUnlockModalTarget, setTempUnlockModalTarget] = useState<string | null>(null);
  const [allowTempCloud, setAllowTempCloud] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [previewItem, setPreviewItem] = useState<PreviewTarget | null>(null);
  const [inlineMediaUrl, setInlineMediaUrl] = useState<string | null>(null);

  // Auto-enable merge when 2+ PDFs or 2+ images are loaded and target is PDF
  const allMergeable =
    selectedInputs.length > 1 &&
    selectedInputs.every((i) => MERGEABLE_FORMATS.has(i.inspection.detectedFormatId));

  useEffect(() => {
    if (toolId === 'pdf-merge' || toolId === 'images-to-pdf') {
      setOptions((prev) => (prev.mergeIntoSinglePdf ? prev : { ...prev, mergeIntoSinglePdf: true }));
    }
  }, [toolId]);

  // Inline video/audio preview URL for media files
  const primaryIsVideo = Boolean(
    primary &&
      (primary.file.type.startsWith('video/') ||
        ['mp4', 'mov', 'm4v', 'webm'].includes(primary.inspection.detectedFormatId)),
  );
  const primaryIsAudio = Boolean(
    primary &&
      (primary.file.type.startsWith('audio/') ||
        ['m4a', 'm4r', 'wav', 'mp3', 'ogg'].includes(primary.inspection.detectedFormatId)),
  );

  useEffect(() => {
    if (!primary || (!primaryIsVideo && !primaryIsAudio)) {
      setInlineMediaUrl(null);
      return;
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(primary.file);
    setInlineMediaUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [primary, primaryIsVideo, primaryIsAudio]);

  const reachableTargets = useMemo(() => {
    if (!primary) return [];
    return conversionGraph.getReachableTargets(
      primary.inspection.detectedFormatId,
      settings.offlineOnlyMode && !allowTempCloud,
      APP_CONFIG.cloudWorkerEnabled,
    );
  }, [primary, settings.offlineOnlyMode, allowTempCloud]);

  const effectiveTarget = useMemo(() => {
    if (toolId === 'pdf-merge' || toolId === 'images-to-pdf') return 'pdf';
    if (toolId === 'ocr-extract') return 'txt';
    if (selectedTarget && (!primary || reachableTargets.some((t) => t.format.id === selectedTarget))) {
      return selectedTarget;
    }
    if (toolSpec && toolSpec.quickTargets.length > 0) {
      const match = toolSpec.quickTargets.find((id) =>
        reachableTargets.some((t) => t.format.id === id),
      );
      if (match) return match;
    }
    const firstUnlocked = reachableTargets.find((t) => !t.plan.blockedByOfflineLock);
    return firstUnlocked?.format.id ?? reachableTargets[0]?.format.id ?? '';
  }, [toolId, selectedTarget, primary, reachableTargets, toolSpec]);

  const activePlan: ConversionPlan | null = useMemo(() => {
    if (!primary || !effectiveTarget) return null;
    return conversionGraph.planConversion(
      primary.inspection.detectedFormatId,
      effectiveTarget,
      {
        offlineOnly: settings.offlineOnlyMode && !allowTempCloud,
        inspection: primary.inspection,
        hasPassword: Boolean(options.password?.trim()),
      },
    );
  }, [primary, effectiveTarget, settings.offlineOnlyMode, allowTempCloud, options.password]);

  const filteredTargets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reachableTargets;
    return reachableTargets.filter(
      (item) =>
        item.format.id.includes(q) ||
        item.format.label.toLowerCase().includes(q) ||
        item.format.category.includes(q),
    );
  }, [query, reachableTargets]);

  const recommended = useMemo(
    () => filteredTargets.filter((t) => t.isPopular).slice(0, 6),
    [filteredTargets],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (list.length > 0) {
      await addFiles(list);
    }
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

  const handleSelectTarget = (formatId: string, blockedByOffline = false) => {
    if (blockedByOffline && settings.offlineOnlyMode && !allowTempCloud) {
      setTempUnlockModalTarget(formatId);
      return;
    }
    setSelectedTarget(formatId);
    if (formatId === 'pdf' && allMergeable) {
      setOptions((prev) => ({ ...prev, mergeIntoSinglePdf: true }));
    }
  };

  const isMergeTool = toolId === 'pdf-merge';
  const needsMoreForMerge = isMergeTool && selectedInputs.length < 2;
  const totalBytes = selectedInputs.reduce((s, x) => s + x.file.size, 0);
  const totalPdfPages = selectedInputs.reduce((s, x) => s + (x.pageCount ?? (x.inspection.detectedFormatId === 'pdf' ? 0 : 1)), 0);

  const isHardBlocked =
    selectedInputs.length === 0 ||
    needsMoreForMerge ||
    Boolean(primary?.inspection.hasDrm) ||
    Boolean(primary?.inspection.isEncrypted && !options.password?.trim()) ||
    (!isMergeTool && !activePlan);

  const handleStart = async () => {
    if (isHardBlocked) return;
    if (activePlan?.blockedByOfflineLock && !allowTempCloud) {
      setTempUnlockModalTarget(effectiveTarget);
      return;
    }
    const finalOptions: ConversionOptions = {
      ...options,
      mergeIntoSinglePdf:
        isMergeTool || toolId === 'images-to-pdf'
          ? true
          : Boolean(options.mergeIntoSinglePdf),
    };
    const started = await enqueueAndRun({
      targetFormat: effectiveTarget || 'pdf',
      options: finalOptions,
      allowCloudOverride: allowTempCloud,
    });
    if (started) {
      onClose();
    }
  };

  const showFullFormatBrowser = toolId === 'universal' || toolId === 'doc-data';
  const showQuickPills = Boolean(
    toolSpec && toolSpec.quickTargets.length > 1 && primary,
  );
  const showPdfSplitRotate =
    (toolId === 'pdf-tools' || primary?.inspection.detectedFormatId === 'pdf') &&
    effectiveTarget === 'pdf' &&
    !isMergeTool &&
    selectedInputs.length === 1;
  const showImageQuality =
    (toolId === 'image-convert' || toolId === 'images-to-pdf') &&
    selectedInputs.length > 0;
  const showVideoResolution =
    (primaryIsVideo || toolId === 'video-compress') &&
    (effectiveTarget === 'mp4' || effectiveTarget === 'mov');
  const showOcrLang = toolId === 'ocr-extract' || (effectiveTarget === 'txt' && (primary?.inspection.detectedFormatId === 'pdf' || primary?.file.type.startsWith('image/')));

  const activeUsesPro = activePlan
    ? isProFeatureJob(activePlan, options, selectedInputs.length)
    : isMergeTool;
  const remainingTrials = getRemainingDailyProTrials(entitlements);

  const ctaLabel = (() => {
    if (activePlan?.blockedByOfflineLock && !allowTempCloud) {
      return dict.targetPicker.lockedByOffline;
    }
    if (isMergeTool && selectedInputs.length >= 2) {
      return interpolate(dict.tools.pdfMerge.cta, { count: selectedInputs.length });
    }
    if (toolId === 'images-to-pdf' && selectedInputs.length > 0) {
      return dict.tools.imagesToPdf.cta;
    }
    if (effectiveTarget) {
      return `${dict.targetPicker.startConversion} (${effectiveTarget.toUpperCase()})`;
    }
    return toolCopy?.cta ?? dict.targetPicker.startConversion;
  })();

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={toolCopy?.title ?? dict.targetPicker.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet">
        <div className="sheet-grabber" />

        <input
          ref={fileInputRef}
          data-testid="workspace-file-input"
          type="file"
          accept={toolSpec?.accept}
          multiple={toolSpec ? toolSpec.multiple : true}
          style={{ display: 'none' }}
          onChange={(e) => void handleFileChange(e)}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {toolCopy?.title ?? dict.targetPicker.title}
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.38 }}>
              {toolCopy?.subtitle ??
                (primary
                  ? selectedInputs.length === 1
                    ? primary.file.name
                    : `${selectedInputs.length} ${dict.convert.selectedFiles.toLowerCase()}`
                  : dict.convert.dropSubtitle)}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={dict.paywall.close}
          >
            <X size={17} />
          </button>
        </div>

        {/* Empty State Picker inside Guided Tool */}
        {selectedInputs.length === 0 ? (
          <button
            type="button"
            data-testid="workspace-pick-btn"
            onClick={() => fileInputRef.current?.click()}
            className="card"
            style={{
              width: '100%',
              padding: '28px 18px',
              background: 'var(--sheet-card)',
              border: '1.5px dashed var(--separator-strong)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: toolSpec?.accentBg ?? 'var(--accent-soft)',
                color: toolSpec?.accentColor ?? 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FilePlus2 size={22} />
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
              {toolCopy?.pickCta ?? dict.convert.dropTitle}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isMergeTool ? dict.tools.pdfMerge.needTwo : dict.convert.dropSubtitle}
            </div>
          </button>
        ) : (
          /* Selected Files with Live Thumbnails, Page Counts, Preview, & Up/Down Reorder */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {dict.convert.selectedFiles} ({selectedInputs.length}) • {formatFileSize(totalBytes)}
                {allMergeable && totalPdfPages > 0 ? ` • ${interpolate(dict.convert.pagesLabel, { count: totalPdfPages })}` : ''}
              </span>
              <button
                type="button"
                data-testid="workspace-add-more-btn"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--accent)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  padding: '2px 4px',
                }}
              >
                <Plus size={15} />
                <span>{dict.convert.addMore.replace(/^\+\s*/, '')}</span>
              </button>
            </div>

            {selectedInputs.length > 1 && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {dict.convert.reorderHint}
              </div>
            )}

            <div className="ios-group" style={{ background: 'var(--sheet-card)', maxHeight: 220, overflowY: 'auto' }}>
              {selectedInputs.map((item, idx) => (
                <div key={item.id} className="ios-row" style={{ padding: '10px 12px', gap: 10 }}>
                  {selectedInputs.length > 1 && (
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}

                  {item.thumbUrl ? (
                    <img
                      src={item.thumbUrl}
                      alt={item.file.name}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '0.5px solid var(--separator)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: 'var(--bg-fill)',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        flexShrink: 0,
                      }}
                    >
                      {item.inspection.detectedFormatId.toUpperCase().slice(0, 4)}
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontWeight: 500, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 1 }}>
                      {formatFileSize(item.file.size)}
                      {item.pageCount ? ` • ${interpolate(dict.convert.pagesLabel, { count: item.pageCount })}` : ''}
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
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {needsMoreForMerge && (
              <div
                role="status"
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--orange-soft)',
                  color: 'var(--orange-text)',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                }}
              >
                {dict.tools.pdfMerge.needTwo}
              </div>
            )}
          </div>
        )}

        {/* Inline Media Player for Video/Audio (Media Converter style!) */}
        {inlineMediaUrl && primaryIsVideo && (
          <video
            controls
            playsInline
            preload="metadata"
            src={inlineMediaUrl}
            style={{ width: '100%', maxHeight: 190, borderRadius: 12, background: '#000000' }}
          />
        )}
        {inlineMediaUrl && primaryIsAudio && (
          <audio controls src={inlineMediaUrl} style={{ width: '100%' }} />
        )}

        {/* Extension mismatch warning */}
        {primary?.inspection.isExtensionMismatch && (
          <div
            role="status"
            style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--orange-soft)',
              color: 'var(--orange-text)',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            {interpolate(dict.convert.extensionMismatch, {
              claimed: primary.inspection.claimedExtension,
              detected: primary.inspection.detectedFormatId,
            })}
          </div>
        )}

        {/* Quick Target Format Pills for Guided Tools */}
        {showQuickPills && toolSpec && (
          <div>
            <div className="section-header" style={{ paddingLeft: 2 }}>
              {dict.targetPicker.title}
            </div>
            <div className="grid-3">
              {toolSpec.quickTargets.map((fmtId) => {
                const selected = effectiveTarget === fmtId;
                return (
                  <button
                    key={fmtId}
                    type="button"
                    data-testid={`target-option-${fmtId}`}
                    onClick={() => handleSelectTarget(fmtId)}
                    style={{
                      padding: '11px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--separator)'}`,
                      background: selected ? 'var(--accent-soft)' : 'var(--sheet-card)',
                      color: selected ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      textAlign: 'center',
                    }}
                  >
                    {fmtId === 'm4r' ? 'M4R (Zil)' : fmtId.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Full Format Picker for Universal / Document & Data Converter */}
        {showFullFormatBrowser && primary && (
          <>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="search"
                className="input-field"
                style={{ paddingLeft: 36 }}
                placeholder={dict.targetPicker.searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={dict.targetPicker.searchPlaceholder}
              />
            </div>

            {recommended.length > 0 && !query.trim() && (
              <div>
                <div className="section-header" style={{ paddingLeft: 2 }}>
                  {dict.targetPicker.recommended}
                </div>
                <div className="grid-3">
                  {recommended.map(({ format, plan }) => {
                    const selected = format.id === effectiveTarget;
                    const locked = plan.blockedByOfflineLock && !allowTempCloud;
                    const needsPro = isProFeatureJob(plan, options, selectedInputs.length);
                    return (
                      <button
                        key={format.id}
                        type="button"
                        data-testid={`target-option-${format.id}`}
                        onClick={() => handleSelectTarget(format.id, plan.blockedByOfflineLock)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 4,
                          padding: '10px 11px',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--separator)'}`,
                          background: selected ? 'var(--accent-soft)' : 'var(--sheet-card)',
                          color: 'var(--text-primary)',
                          opacity: locked ? 0.65 : 1,
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {format.id.toUpperCase()}
                          </span>
                          {locked && <Lock size={12} color="var(--text-muted)" />}
                        </div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: needsPro && !entitlements.isPro ? 'var(--accent)' : 'var(--green-text)',
                          }}
                        >
                          {needsPro && !entitlements.isPro ? dict.badges.proTag : dict.badges.localShort}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="section-header" style={{ paddingLeft: 2 }}>
                {dict.targetPicker.allMatching}
              </div>
              {filteredTargets.length === 0 ? (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', padding: '8px 2px' }}>
                  {dict.targetPicker.noResults}
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                    gap: 8,
                    maxHeight: 150,
                    overflowY: 'auto',
                  }}
                >
                  {filteredTargets.map(({ format, plan }) => {
                    const selected = format.id === effectiveTarget;
                    const locked = plan.blockedByOfflineLock && !allowTempCloud;
                    const needsPro = isProFeatureJob(plan, options, selectedInputs.length);
                    return (
                      <button
                        key={format.id}
                        type="button"
                        data-testid={`target-all-${format.id}`}
                        onClick={() => handleSelectTarget(format.id, plan.blockedByOfflineLock)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 3,
                          padding: '9px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--separator)'}`,
                          background: selected ? 'var(--accent-soft)' : 'var(--sheet-card)',
                          color: 'var(--text-primary)',
                          opacity: locked ? 0.65 : 1,
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                            {format.id.toUpperCase()}
                          </span>
                          {locked && <Lock size={11} color="var(--text-muted)" />}
                        </div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: needsPro && !entitlements.isPro ? 'var(--accent)' : 'var(--text-muted)',
                          }}
                        >
                          {needsPro && !entitlements.isPro ? dict.badges.proTag : dict.badges.localShort}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Visible Contextual Options (Never Hidden!) */}
        {showPdfSplitRotate && (
          <div className="card" style={{ background: 'var(--sheet-card)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {dict.targetPicker.pdfPageRange}
                {primary?.pageCount ? ` (${interpolate(dict.convert.pagesLabel, { count: primary.pageCount })})` : ''}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder={dict.targetPicker.pdfPageRangePlaceholder}
                value={options.pdfPageRange ?? ''}
                onChange={(e) => setOptions((prev) => ({ ...prev, pdfPageRange: e.target.value }))}
              />
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {dict.targetPicker.pdfRotate}
              </div>
              <div className="ios-segmented">
                {([0, 90, 180, 270] as const).map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    className={`ios-segmented-btn${(options.pdfRotateDegrees ?? 0) === deg ? ' is-active' : ''}`}
                    onClick={() => setOptions((prev) => ({ ...prev, pdfRotateDegrees: deg }))}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showImageQuality && (
          <div className="card" style={{ background: 'var(--sheet-card)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>{dict.targetPicker.quality}</span>
                <span>{options.quality}%</span>
              </div>
              <div className="ios-segmented">
                {(
                  [
                    [68, 1280, dict.targetPicker.qualitySmall],
                    [85, undefined, dict.targetPicker.qualityBalanced],
                    [96, undefined, dict.targetPicker.qualityHigh],
                  ] as const
                ).map(([q, maxDim, label]) => (
                  <button
                    key={label}
                    type="button"
                    className={`ios-segmented-btn${options.quality === q ? ' is-active' : ''}`}
                    onClick={() =>
                      setOptions((prev) => ({ ...prev, quality: q, maxDimension: maxDim }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {dict.targetPicker.stripExif}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {dict.targetPicker.stripExifDesc}
                </div>
              </div>
              <IosSwitch
                checked={options.stripExif}
                onChange={(v) => setOptions((prev) => ({ ...prev, stripExif: v }))}
                ariaLabel={dict.targetPicker.stripExif}
              />
            </div>
          </div>
        )}

        {showVideoResolution && (
          <div className="card" style={{ background: 'var(--sheet-card)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {dict.targetPicker.videoResolution}
            </div>
            <div className="ios-segmented">
              {(['480p', '720p', '1080p'] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  className={`ios-segmented-btn${(options.videoResolution ?? '720p') === res ? ' is-active' : ''}`}
                  onClick={() => setOptions((prev) => ({ ...prev, videoResolution: res }))}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        )}

        {showOcrLang && (
          <div className="card" style={{ background: 'var(--sheet-card)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {dict.targetPicker.ocrLanguage}
            </div>
            <div className="ios-segmented">
              {(
                [
                  ['tr', 'Türkçe'],
                  ['en', 'English'],
                  ['de', 'Deutsch'],
                  ['es', 'Español'],
                ] as const
              ).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  className={`ios-segmented-btn${options.ocrLanguage === code ? ' is-active' : ''}`}
                  onClick={() => setOptions((prev) => ({ ...prev, ocrLanguage: code }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prominent Merge Switch when 2+ PDFs/Images loaded in universal mode */}
        {!isMergeTool && toolId !== 'images-to-pdf' && allMergeable && effectiveTarget === 'pdf' && (
          <div
            className="card"
            style={{
              background: 'var(--sheet-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {dict.targetPicker.mergeIntoSinglePdf}
            </span>
            <IosSwitch
              checked={Boolean(options.mergeIntoSinglePdf)}
              onChange={(v) => setOptions((prev) => ({ ...prev, mergeIntoSinglePdf: v }))}
              ariaLabel={dict.targetPicker.mergeIntoSinglePdf}
            />
          </div>
        )}

        {/* Route Summary + Privacy Pill */}
        {activePlan && primary && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--sheet-card)',
              border: '0.5px solid var(--separator)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              <span>{activePlan.sourceFormat.toUpperCase()}</span>
              {activePlan.steps.map((step, idx) => (
                <React.Fragment key={`${step.source}-${step.target}-${idx}`}>
                  <ArrowRight size={13} color="var(--text-muted)" />
                  <span>{step.target.toUpperCase()}</span>
                </React.Fragment>
              ))}
            </div>
            <PrivacyBadge tier={activePlan.highestTier} compact />
          </div>
        )}

        {/* Calm Free Daily Pro Trial Info */}
        {activeUsesPro && !entitlements.isPro && selectedInputs.length > 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0 2px' }}>
            {interpolate(dict.targetPicker.proTrialHint, { count: remainingTrials })}
          </div>
        )}

        {activePlan && activePlan.warnings.length > 0 && (
          <WarningCard codes={activePlan.warnings} />
        )}

        {primary?.inspection.isEncrypted && (
          <div>
            <label
              htmlFor="omni-file-password"
              style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}
            >
              {dict.targetPicker.pdfPassword}
            </label>
            <input
              id="omni-file-password"
              type="password"
              className="input-field"
              placeholder={dict.targetPicker.pdfPasswordPlaceholder}
              value={options.password ?? ''}
              onChange={(e) => setOptions((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
        )}

        {/* Optional Fine-Tune Disclosure */}
        {selectedInputs.length > 0 && (
          <div className="ios-group" style={{ background: 'var(--sheet-card)' }}>
            <button
              type="button"
              className="ios-row ios-row-interactive"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                <SlidersHorizontal size={16} color="var(--accent)" />
                {dict.targetPicker.advancedSettings}
              </span>
              {advancedOpen ? (
                <ChevronUp size={16} color="var(--text-muted)" />
              ) : (
                <ChevronDown size={16} color="var(--text-muted)" />
              )}
            </button>

            {advancedOpen && (
              <div
                style={{
                  padding: '12px 15px 15px 15px',
                  borderTop: '0.5px solid var(--separator)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div className="grid-2">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      {dict.targetPicker.maxDimension}
                    </label>
                    <input
                      type="number"
                      min={128}
                      max={8192}
                      placeholder="Otomatik"
                      className="input-field"
                      value={options.maxDimension ?? ''}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          maxDimension: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      {dict.targetPicker.dpi}
                    </label>
                    <select
                      className="input-field"
                      value={options.dpi ?? 150}
                      onChange={(e) => setOptions((prev) => ({ ...prev, dpi: Number(e.target.value) }))}
                    >
                      <option value={72}>72</option>
                      <option value={150}>150</option>
                      <option value={300}>300</option>
                    </select>
                  </div>
                </div>

                {showPresetSave ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder={dict.history.presetNamePrompt}
                      value={presetNameInput}
                      onChange={(e) => setPresetNameInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!presetNameInput.trim() || !effectiveTarget}
                      onClick={() => {
                        saveCustomPreset(presetNameInput, effectiveTarget, options);
                        setPresetNameInput('');
                        setShowPresetSave(false);
                      }}
                    >
                      {dict.queue.save}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                    onClick={() => setShowPresetSave(true)}
                  >
                    {dict.targetPicker.saveAsPreset}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Primary Action CTA */}
        <button
          type="button"
          className="btn btn-primary"
          disabled={isHardBlocked}
          data-testid="start-conversion-btn"
          onClick={() => void handleStart()}
          style={{ width: '100%' }}
        >
          {ctaLabel}
        </button>

        {/* Temp Cloud Unlock Confirmation */}
        {tempUnlockModalTarget && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 120 }}
            role="alertdialog"
            aria-modal="true"
            aria-label={dict.offlineLock.tempAllowTitle}
          >
            <div className="modal-sheet" style={{ maxWidth: 380 }}>
              <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>
                {dict.offlineLock.tempAllowTitle}
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {dict.offlineLock.tempAllowBody}
              </p>
              <div className="grid-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTempUnlockModalTarget(null)}
                >
                  {dict.offlineLock.cancel}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid="confirm-temp-cloud-btn"
                  onClick={() => {
                    setAllowTempCloud(true);
                    setSelectedTarget(tempUnlockModalTarget);
                    setTempUnlockModalTarget(null);
                  }}
                >
                  {dict.offlineLock.tempAllowConfirm}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Input File Preview Modal */}
        <FilePreviewModal target={previewItem} onClose={() => setPreviewItem(null)} />
      </div>
    </div>
  );
};

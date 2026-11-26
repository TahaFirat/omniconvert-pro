import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eye,
  FilePlus2,
  Lock,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
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
import { formatFileSize, middleTruncate } from '../components/formatBytes';
import { IosSwitch } from '../components/IosSwitch';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { WarningCard } from '../components/WarningCard';

interface ToolWorkspaceSheetProps {
  toolId: GuidedToolId;
  initialTarget?: string;
  initialOptions?: Partial<ConversionOptions>;
  onClose: () => void;
  embeddedInShell?: boolean;
}

const MERGEABLE_FORMATS = new Set(['pdf', 'png', 'jpg', 'webp', 'bmp', 'heic', 'heif', 'tiff', 'svg']);

export const ToolWorkspaceSheet: React.FC<ToolWorkspaceSheetProps> = ({
  toolId,
  initialTarget,
  initialOptions,
  onClose,
  embeddedInShell = false,
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
    registerOverlay,
  } = useApp();

  // Synchronously hide TopBar & BottomNav if mounted standalone outside AppShell
  useLayoutEffect(() => {
    if (embeddedInShell) return;
    return registerOverlay();
  }, [embeddedInShell, registerOverlay]);

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

  const allMergeable =
    selectedInputs.length > 1 &&
    selectedInputs.every((i) => MERGEABLE_FORMATS.has(i.inspection.detectedFormatId));

  useEffect(() => {
    if (toolId === 'pdf-merge' || toolId === 'images-to-pdf') {
      setOptions((prev) => (prev.mergeIntoSinglePdf ? prev : { ...prev, mergeIntoSinglePdf: true }));
    }
  }, [toolId]);

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
    () => filteredTargets.filter((t) => t.isPopular && t.plan.steps.length === 1).slice(0, 6),
    [filteredTargets],
  );

  // Deduplicated secondary formats: exclude already-shown Recommended cards & hide noisy multi-hop formats unless searching!
  const otherFormats = useMemo(() => {
    const q = query.trim();
    if (q) return filteredTargets;
    const recIds = new Set(recommended.map((r) => r.format.id));
    return filteredTargets.filter((t) => !recIds.has(t.format.id) && t.plan.steps.length === 1);
  }, [filteredTargets, recommended, query]);

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
  const totalPdfPages = selectedInputs.reduce(
    (s, x) => s + (x.pageCount ?? (x.inspection.detectedFormatId === 'pdf' ? 0 : 1)),
    0,
  );

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
  const showQuickPills = Boolean(toolSpec && toolSpec.quickTargets.length > 1 && primary);
  const showPdfSplitRotate =
    (toolId === 'pdf-tools' || primary?.inspection.detectedFormatId === 'pdf') &&
    effectiveTarget === 'pdf' &&
    !isMergeTool &&
    selectedInputs.length === 1;
  const showImageQuality =
    (toolId === 'image-convert' || toolId === 'images-to-pdf') && selectedInputs.length > 0;
  const showVideoResolution =
    (primaryIsVideo || toolId === 'video-compress') &&
    (effectiveTarget === 'mp4' || effectiveTarget === 'mov');
  const showOcrLang =
    toolId === 'ocr-extract' ||
    (effectiveTarget === 'txt' &&
      (primary?.inspection.detectedFormatId === 'pdf' || primary?.file.type.startsWith('image/')));

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

  const workspaceView = (
    <div
      className={embeddedInShell ? 'fullscreen-view fullscreen-view--flow' : 'fullscreen-view'}
      role="dialog"
      aria-modal="true"
      aria-label={toolCopy?.title ?? dict.targetPicker.title}
    >
      <input
        ref={fileInputRef}
        data-testid="workspace-file-input"
        type="file"
        accept={toolSpec?.accept}
        multiple={toolSpec ? toolSpec.multiple : true}
        style={{ display: 'none' }}
        onChange={(e) => void handleFileChange(e)}
      />

      {/* 1. Sticky Native iOS Top Nav Bar (< Back | Title | + Add) */}
      <header className="fullscreen-header">
        <div className="fullscreen-header-inner">
          <button
            type="button"
            className="nav-back-btn"
            onClick={onClose}
            aria-label={dict.paywall.close}
            data-testid="workspace-back-btn"
          >
            <ChevronLeft size={22} strokeWidth={2.3} />
            <span>{dict.paywall.close}</span>
          </button>

          <h2
            className="truncate"
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 700,
              textAlign: 'center',
              flex: 1,
              color: 'var(--text-primary)',
            }}
          >
            {toolCopy?.title ?? dict.targetPicker.title}
          </h2>

          <button
            type="button"
            className="icon-btn"
            data-testid="workspace-add-more-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label={dict.convert.addMore}
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Plus size={20} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {/* 2. SINGLE Smooth Full-Screen Scroll Stage (Zero Nested Scroll Traps, Zero Overlap!) */}
      <div className="fullscreen-body">
        <div className="fullscreen-body-inner">
          {/* Concise Tool Guidance Banner */}
          {toolCopy && (
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {toolCopy.subtitle}
            </p>
          )}

          {/* Empty State Drop Card */}
          {selectedInputs.length === 0 ? (
            <button
              type="button"
              data-testid="workspace-pick-btn"
              onClick={() => fileInputRef.current?.click()}
              className="card"
              style={{
                width: '100%',
                padding: '36px 20px',
                border: '1.5px dashed var(--separator-strong)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: toolSpec?.accentBg ?? 'var(--accent-soft)',
                  color: toolSpec?.accentColor ?? 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FilePlus2 size={26} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.04rem', color: 'var(--text-primary)' }}>
                {toolCopy?.pickCta ?? dict.convert.dropTitle}
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.4 }}>
                {isMergeTool ? dict.tools.pdfMerge.needTwo : dict.convert.dropSubtitle}
              </div>
            </button>
          ) : (
            /* Spacious Selected File Cards (Apple HIG 3-Zone Row + Dedicated Action Strip) */
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '0 4px',
                }}
              >
                <span className="section-header tabular" style={{ margin: 0, padding: 0 }}>
                  {dict.convert.selectedFiles} ({selectedInputs.length}) · {formatFileSize(totalBytes)}
                  {allMergeable && totalPdfPages > 0
                    ? ` · ${interpolate(dict.convert.pagesLabel, { count: totalPdfPages })}`
                    : ''}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedInputs.map((item, idx) => (
                  <div key={item.id} className="file-item-card">
                    <div className="file-item-main">
                      {/* Leading Thumbnail / Format Badge with Order Chip */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {item.thumbUrl ? (
                          <img
                            src={item.thumbUrl}
                            alt={item.file.name}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 11,
                              objectFit: 'cover',
                              display: 'block',
                              border: '0.5px solid var(--separator)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 11,
                              background: 'var(--bg-fill)',
                              color: 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
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
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              color: '#FFFFFF',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            }}
                          >
                            {idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Center Text Stack — Full Readable Middle-Truncated Filename */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.96rem',
                            color: 'var(--text-primary)',
                            lineHeight: 1.3,
                            wordBreak: 'break-word',
                          }}
                        >
                          {middleTruncate(item.file.name, 34)}
                        </div>
                        <div className="tabular" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                          {item.inspection.detectedFormatId.toUpperCase()} · {formatFileSize(item.file.size)}
                          {item.pageCount
                            ? ` · ${interpolate(dict.convert.pagesLabel, { count: item.pageCount })}`
                            : ''}
                        </div>
                      </div>
                    </div>

                    {/* Clean Spacious Action Strip — Zero Tiny Crammed Buttons! */}
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

              {needsMoreForMerge && (
                <div
                  role="status"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--orange-soft)',
                    color: 'var(--orange-text)',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    lineHeight: 1.4,
                  }}
                >
                  {dict.tools.pdfMerge.needTwo}
                </div>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={18} />
                <span>{(toolCopy?.pickCta ?? dict.convert.addMore).replace(/^\+\s*/, '')}</span>
              </button>
            </section>
          )}

          {/* Inline Media Player for Video/Audio */}
          {inlineMediaUrl && primaryIsVideo && (
            <video
              controls
              playsInline
              preload="metadata"
              src={inlineMediaUrl}
              style={{ width: '100%', maxHeight: 220, borderRadius: 14, background: '#000000' }}
            />
          )}
          {inlineMediaUrl && primaryIsAudio && (
            <div className="card">
              <audio controls src={inlineMediaUrl} style={{ width: '100%' }} />
            </div>
          )}

          {/* Extension mismatch warning */}
          {primary?.inspection.isExtensionMismatch && (
            <div
              role="status"
              style={{
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--orange-soft)',
                color: 'var(--orange-text)',
                fontSize: '0.84rem',
                fontWeight: 500,
              }}
            >
              {interpolate(dict.convert.extensionMismatch, {
                claimed: primary.inspection.claimedExtension,
                detected: primary.inspection.detectedFormatId,
              })}
            </div>
          )}

          {/* Quick Format Selector Pills for Guided Tools */}
          {showQuickPills && toolSpec && (
            <section>
              <div className="section-header">{dict.targetPicker.title}</div>
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
                        minHeight: 48,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--separator)'}`,
                        background: selected ? 'var(--accent-soft)' : 'var(--bg-surface)',
                        color: selected ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        textAlign: 'center',
                      }}
                    >
                      {fmtId === 'm4r' ? 'M4R (Zil)' : fmtId.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Full Format Browser for Universal / Document & Data Converter (NO nested scroll trap!) */}
          {showFullFormatBrowser && primary && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={17}
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="search"
                  className="input-field"
                  style={{ paddingLeft: 40 }}
                  placeholder={dict.targetPicker.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={dict.targetPicker.searchPlaceholder}
                />
              </div>

              {recommended.length > 0 && !query.trim() && (
                <div>
                  <div className="section-header">{dict.targetPicker.recommended}</div>
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
                            justifyContent: 'center',
                            gap: 4,
                            minHeight: 60,
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--separator)'}`,
                            background: selected ? 'var(--accent-soft)' : 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            opacity: locked ? 0.65 : 1,
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                              {format.id.toUpperCase()}
                            </span>
                            {locked && <Lock size={13} color="var(--text-muted)" />}
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

              {otherFormats.length > 0 && (
                <div>
                  <div className="section-header">
                    {query.trim() ? dict.targetPicker.allMatching : dict.targetPicker.allMatching}
                  </div>
                  <div className="grid-3">
                    {otherFormats.map(({ format, plan }) => {
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
                            justifyContent: 'center',
                            gap: 3,
                            minHeight: 56,
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--separator)'}`,
                            background: selected ? 'var(--accent-soft)' : 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            opacity: locked ? 0.65 : 1,
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              {format.id.toUpperCase()}
                            </span>
                            {locked && <Lock size={12} color="var(--text-muted)" />}
                          </div>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: needsPro && !entitlements.isPro ? 'var(--accent)' : 'var(--text-muted)',
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

              {filteredTargets.length === 0 && (
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', padding: '8px 4px' }}>
                  {dict.targetPicker.noResults}
                </div>
              )}
            </section>
          )}

          {/* Contextual Visible Options */}
          {showPdfSplitRotate && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {dict.targetPicker.pdfPageRange}
                  {primary?.pageCount
                    ? ` (${interpolate(dict.convert.pagesLabel, { count: primary.pageCount })})`
                    : ''}
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
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
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
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <span>{dict.targetPicker.quality}</span>
                  <span className="tabular">{options.quality}%</span>
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
                      onClick={() => setOptions((prev) => ({ ...prev, quality: q, maxDimension: maxDim }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {dict.targetPicker.stripExif}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {dict.targetPicker.stripExifDesc}
                  </div>
                </div>
                <IosSwitch
                  checked={options.stripExif}
                  onChange={(v) => setOptions((prev) => ({ ...prev, stripExif: v }))}
                  ariaLabel={dict.targetPicker.stripExif}
                />
              </div>

              {effectiveTarget === 'pdf' && (
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Sayfa Boyutu
                  </div>
                  <div className="ios-segmented">
                    {(
                      [
                        ['fit', 'Görsele Sığdır'],
                        ['a4', 'A4 Otomatik'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`ios-segmented-btn${(options.pdfPageFit ?? 'fit') === mode ? ' is-active' : ''}`}
                        onClick={() => setOptions((prev) => ({ ...prev, pdfPageFit: mode }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {showVideoResolution && (
            <div className="card">
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
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
            <div className="card">
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
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

          {!isMergeTool && toolId !== 'images-to-pdf' && allMergeable && effectiveTarget === 'pdf' && (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {dict.targetPicker.mergeIntoSinglePdf}
              </span>
              <IosSwitch
                checked={Boolean(options.mergeIntoSinglePdf)}
                onChange={(v) => setOptions((prev) => ({ ...prev, mergeIntoSinglePdf: v }))}
                ariaLabel={dict.targetPicker.mergeIntoSinglePdf}
              />
            </div>
          )}

          {/* Route Summary */}
          {activePlan && primary && (
            <div
              className="card"
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <span>{activePlan.sourceFormat.toUpperCase()}</span>
                {activePlan.steps.map((step, idx) => (
                  <React.Fragment key={`${step.source}-${step.target}-${idx}`}>
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <span>{step.target.toUpperCase()}</span>
                  </React.Fragment>
                ))}
              </div>
              <PrivacyBadge tier={activePlan.highestTier} compact />
            </div>
          )}

          {activePlan && activePlan.warnings.length > 0 && <WarningCard codes={activePlan.warnings} />}

          {primary?.inspection.isEncrypted && (
            <div className="card">
              <label
                htmlFor="omni-file-password"
                style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}
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

          {/* Fine-Tune Options Disclosure */}
          {selectedInputs.length > 0 && (
            <div className="ios-group">
              <button
                type="button"
                className="ios-row ios-row-interactive"
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 500, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  <SlidersHorizontal size={17} color="var(--accent)" />
                  {dict.targetPicker.advancedSettings}
                </span>
                {advancedOpen ? (
                  <ChevronUp size={18} color="var(--text-muted)" />
                ) : (
                  <ChevronDown size={18} color="var(--text-muted)" />
                )}
              </button>

              {advancedOpen && (
                <div
                  style={{
                    padding: '14px 16px 16px 16px',
                    borderTop: '0.5px solid var(--separator)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div className="grid-2">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
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
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
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
                    <div style={{ display: 'flex', gap: 10 }}>
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
        </div>
      </div>

      {/* 3. Sticky Pinned Bottom Action Bar — NEVER Overlaps, ALWAYS Clickable! */}
      <footer className="fullscreen-footer">
        <div className="fullscreen-footer-inner">
          {activeUsesPro && !entitlements.isPro && selectedInputs.length > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {interpolate(dict.targetPicker.proTrialHint, { count: remainingTrials })}
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={isHardBlocked}
            data-testid="start-conversion-btn"
            onClick={() => void handleStart()}
            style={{ width: '100%' }}
          >
            {ctaLabel}
          </button>
        </div>
      </footer>

      {/* Temp Cloud Unlock Confirmation */}
      {tempUnlockModalTarget && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 130 }}
          role="alertdialog"
          aria-modal="true"
          aria-label={dict.offlineLock.tempAllowTitle}
        >
          <div className="modal-sheet" style={{ maxWidth: 400 }}>
            <div className="modal-sheet-header">
              <div className="sheet-grabber" />
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{dict.offlineLock.tempAllowTitle}</div>
            </div>
            <div className="modal-sheet-body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.48 }}>
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
        </div>
      )}

      {/* Full-Screen Input File Preview */}
      <FilePreviewModal target={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );

  if (embeddedInShell) {
    return workspaceView;
  }

  return typeof document !== 'undefined' ? createPortal(workspaceView, document.body) : workspaceView;
};

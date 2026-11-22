import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lock,
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
import { IosSwitch } from '../components/IosSwitch';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { WarningCard } from '../components/WarningCard';

interface TargetPickerSheetProps {
  inputs: SelectedInputItem[];
  initialTarget?: string;
  initialOptions?: Partial<ConversionOptions>;
  onClose: () => void;
}

export const TargetPickerSheet: React.FC<TargetPickerSheetProps> = ({
  inputs,
  initialTarget,
  initialOptions,
  onClose,
}) => {
  const { settings, dict, entitlements, enqueueAndRun, saveCustomPreset } = useApp();
  const primary = inputs[0];

  const [query, setQuery] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string>(initialTarget ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(
    primary?.inspection.detectedFormatId === 'pdf' && initialTarget === 'pdf',
  );
  const [options, setOptions] = useState<ConversionOptions>({
    ...DEFAULT_CONVERSION_OPTIONS,
    stripExif: settings.defaultStripExif,
    ...initialOptions,
  });
  const [tempUnlockModalTarget, setTempUnlockModalTarget] = useState<string | null>(null);
  const [allowTempCloud, setAllowTempCloud] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  const reachableTargets = useMemo(() => {
    if (!primary) return [];
    return conversionGraph.getReachableTargets(
      primary.inspection.detectedFormatId,
      settings.offlineOnlyMode && !allowTempCloud,
      APP_CONFIG.cloudWorkerEnabled,
    );
  }, [primary, settings.offlineOnlyMode, allowTempCloud]);

  const effectiveTarget = useMemo(() => {
    if (selectedTarget && reachableTargets.some((t) => t.format.id === selectedTarget)) {
      return selectedTarget;
    }
    const firstUnlocked = reachableTargets.find((t) => !t.plan.blockedByOfflineLock);
    return firstUnlocked?.format.id ?? reachableTargets[0]?.format.id ?? '';
  }, [reachableTargets, selectedTarget]);

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

  if (!primary) return null;

  const isHardBlocked =
    primary.inspection.hasDrm ||
    (primary.inspection.isEncrypted && !options.password?.trim()) ||
    !activePlan;

  const handleSelectTarget = (formatId: string, blockedByOffline: boolean) => {
    if (blockedByOffline && settings.offlineOnlyMode && !allowTempCloud) {
      setTempUnlockModalTarget(formatId);
      return;
    }
    setSelectedTarget(formatId);
  };

  const handleStart = async () => {
    if (!activePlan || isHardBlocked) return;
    if (activePlan.blockedByOfflineLock && !allowTempCloud) {
      setTempUnlockModalTarget(effectiveTarget);
      return;
    }
    await enqueueAndRun({
      targetFormat: effectiveTarget,
      options,
      allowCloudOverride: allowTempCloud,
    });
    onClose();
  };

  const allImages = inputs.every((i) =>
    ['png', 'jpg', 'webp', 'bmp'].includes(i.inspection.detectedFormatId),
  );
  const allPdfs = inputs.every((i) => i.inspection.detectedFormatId === 'pdf');
  const isPdfToolkit = primary.inspection.detectedFormatId === 'pdf' && effectiveTarget === 'pdf';
  const isVideoSource = ['mp4', 'mov', 'm4v'].includes(primary.inspection.detectedFormatId);

  const activeUsesPro = activePlan ? isProFeatureJob(activePlan, options, inputs.length) : false;
  const remainingTrials = getRemainingDailyProTrials(entitlements);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dict.targetPicker.title}>
      <div className="modal-sheet">
        <div className="sheet-grabber" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {dict.targetPicker.title}
            </h2>
            <div className="truncate" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {inputs.length === 1 ? primary.file.name : `${inputs.length} ${dict.convert.selectedFiles.toLowerCase()}`}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: 34, height: 34, minHeight: 34, padding: 0, borderRadius: '50%' }}
            onClick={onClose}
            aria-label={dict.paywall.close}
          >
            <X size={17} />
          </button>
        </div>

        {primary.inspection.isExtensionMismatch && (
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

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search
            size={15}
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
            style={{ paddingLeft: 35 }}
            placeholder={dict.targetPicker.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={dict.targetPicker.searchPlaceholder}
          />
        </div>

        {/* Suggested Formats */}
        {recommended.length > 0 && !query.trim() && (
          <div>
            <div className="section-header" style={{ paddingLeft: 2 }}>
              {dict.targetPicker.recommended}
            </div>
            <div className="grid-3">
              {recommended.map(({ format, plan }) => {
                const selected = format.id === effectiveTarget;
                const locked = plan.blockedByOfflineLock && !allowTempCloud;
                const needsPro = isProFeatureJob(plan, options, inputs.length);
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
                      gap: 5,
                      padding: '11px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${selected ? 'var(--accent)' : 'transparent'}`,
                      background: selected ? 'var(--accent-soft)' : 'var(--sheet-card)',
                      opacity: locked ? 0.65 : 1,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                        {format.id.toUpperCase()}
                      </span>
                      {locked && <Lock size={12} color="var(--text-muted)" />}
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 500,
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

        {/* All Compatible Formats */}
        <div>
          <div className="section-header" style={{ paddingLeft: 2 }}>
            {dict.targetPicker.allMatching}
          </div>
          {filteredTargets.length === 0 ? (
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', padding: '10px 2px' }}>
              {dict.targetPicker.noResults}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
                gap: 8,
                maxHeight: 170,
                overflowY: 'auto',
              }}
            >
              {filteredTargets.map(({ format, plan }) => {
                const selected = format.id === effectiveTarget;
                const locked = plan.blockedByOfflineLock && !allowTempCloud;
                const needsPro = isProFeatureJob(plan, options, inputs.length);
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
                      border: `1.5px solid ${selected ? 'var(--accent)' : 'transparent'}`,
                      background: selected ? 'var(--accent-soft)' : 'var(--sheet-card)',
                      opacity: locked ? 0.65 : 1,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>
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

        {/* Route Summary */}
        {activePlan && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--sheet-card)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', fontWeight: 600 }}>
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

        {/* Calm Free Pro Trial Notice */}
        {activeUsesPro && !entitlements.isPro && (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', padding: '0 2px' }}>
            {interpolate(dict.targetPicker.proTrialHint, { count: remainingTrials })}
          </div>
        )}

        {activePlan && activePlan.warnings.length > 0 && (
          <WarningCard codes={activePlan.warnings} />
        )}

        {primary.inspection.isEncrypted && (
          <div>
            <label
              htmlFor="omni-file-password"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}
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

        {/* Options Disclosure */}
        <div className="ios-group" style={{ background: 'var(--sheet-card)' }}>
          <button
            type="button"
            className="ios-row ios-row-interactive"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: '0.9rem' }}>
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
                padding: '12px 16px 16px 16px',
                borderTop: '0.5px solid var(--separator)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {/* PDF Split / Rotate Studio Controls */}
              {isPdfToolkit && (
                <div className="grid-2">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      {dict.targetPicker.pdfPageRange}
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
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      {dict.targetPicker.pdfRotate}
                    </label>
                    <select
                      className="input-field"
                      value={options.pdfRotateDegrees ?? 0}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          pdfRotateDegrees: Number(e.target.value) as 0 | 90 | 180 | 270,
                        }))
                      }
                    >
                      <option value={0}>0°</option>
                      <option value={90}>90°</option>
                      <option value={180}>180°</option>
                      <option value={270}>270°</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Video Resolution Selector */}
              {isVideoSource && (effectiveTarget === 'mp4' || effectiveTarget === 'mov') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                    {dict.targetPicker.videoResolution}
                  </label>
                  <div className="ios-segmented">
                    {(['1080p', '720p', '480p'] as const).map((res) => (
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

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 6 }}>
                  <span>{dict.targetPicker.quality}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{options.quality}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={1}
                  value={options.quality}
                  onChange={(e) => setOptions((prev) => ({ ...prev, quality: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>

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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{dict.targetPicker.stripExif}</div>
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

              {(allImages || allPdfs) && inputs.length > 1 && effectiveTarget === 'pdf' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                    {dict.targetPicker.mergeIntoSinglePdf}
                  </span>
                  <IosSwitch
                    checked={Boolean(options.mergeIntoSinglePdf)}
                    onChange={(v) => setOptions((prev) => ({ ...prev, mergeIntoSinglePdf: v }))}
                    ariaLabel={dict.targetPicker.mergeIntoSinglePdf}
                  />
                </div>
              )}

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

        <button
          type="button"
          className="btn btn-primary"
          disabled={isHardBlocked}
          data-testid="start-conversion-btn"
          onClick={() => void handleStart()}
          style={{ width: '100%' }}
        >
          {activePlan?.blockedByOfflineLock && !allowTempCloud
            ? dict.targetPicker.lockedByOffline
            : dict.targetPicker.startConversion}
        </button>

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
      </div>
    </div>
  );
};

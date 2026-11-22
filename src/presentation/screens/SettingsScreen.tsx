import React, { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { getRemainingDailyFreeTrials } from '../../application/billingService';
import { APP_CONFIG, OPEN_SOURCE_NOTICES } from '../../core/constants';
import { SUPPORTED_LOCALES } from '../../core/i18n';
import type { ThemeMode } from '../../infrastructure/storage/localDb';
import { formatFileSize } from '../components/formatBytes';
import { IosSwitch } from '../components/IosSwitch';

export const SettingsScreen: React.FC = () => {
  const {
    dict,
    settings,
    toggleOfflineOnlyMode,
    setDefaultStripExif,
    setTheme,
    setLocale,
    entitlements,
    setPaywallOpen,
    restorePurchases,
    cacheBytes,
    clearTempCache,
    resetAllLocalData,
  } = useApp();

  const [licensesOpen, setLicensesOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const remainingTrials = getRemainingDailyFreeTrials(entitlements);

  const themes: Array<{ id: ThemeMode; label: string }> = [
    { id: 'system', label: dict.settings.themeSystem },
    { id: 'light', label: dict.settings.themeLight },
    { id: 'dark', label: dict.settings.themeDark },
    { id: 'amoled', label: dict.settings.themeAmoled },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Privacy */}
      <section>
        <h2 className="section-header">{dict.settings.privacySection}</h2>
        <div className="ios-group">
          <div className="ios-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '0.94rem' }}>{dict.settings.offlineMode}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {dict.settings.offlineModeDesc}
              </div>
            </div>
            <IosSwitch
              checked={settings.offlineOnlyMode}
              onChange={toggleOfflineOnlyMode}
              ariaLabel={dict.settings.offlineMode}
            />
          </div>

          <div className="ios-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '0.94rem' }}>{dict.settings.defaultStripExif}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {dict.settings.defaultStripExifDesc}
              </div>
            </div>
            <IosSwitch
              checked={settings.defaultStripExif}
              onChange={setDefaultStripExif}
              ariaLabel={dict.settings.defaultStripExif}
            />
          </div>
        </div>
      </section>

      {/* Plan & Credits */}
      <section>
        <h2 className="section-header">{dict.settings.billingSection}</h2>
        <div className="ios-group">
          <div className="ios-row">
            <span style={{ fontWeight: 500, fontSize: '0.94rem' }}>{dict.settings.cloudCredits}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.92rem', fontWeight: 500 }}>
              {entitlements.isPro ? dict.settings.proStatusActive : entitlements.cloudCreditsBalance}
            </span>
          </div>

          <div className="ios-row">
            <span style={{ fontWeight: 500, fontSize: '0.94rem' }}>{dict.settings.dailyTrials}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.92rem', fontWeight: 500 }}>
              {remainingTrials} / 3
            </span>
          </div>

          <button
            type="button"
            className="ios-row ios-row-interactive"
            data-testid="open-paywall-btn"
            onClick={() => setPaywallOpen(true)}
          >
            <span style={{ fontWeight: 500, fontSize: '0.94rem', color: 'var(--accent)' }}>
              {dict.settings.managePlan}
            </span>
            <ChevronRight size={17} color="var(--text-muted)" />
          </button>

          <button
            type="button"
            className="ios-row ios-row-interactive"
            data-testid="settings-restore-btn"
            onClick={() => void restorePurchases()}
          >
            <span style={{ fontWeight: 500, fontSize: '0.94rem' }}>
              {dict.settings.restorePurchases}
            </span>
            <ChevronRight size={17} color="var(--text-muted)" />
          </button>
        </div>
      </section>

      {/* Appearance & Language */}
      <section>
        <h2 className="section-header">{dict.settings.appearanceSection}</h2>
        <div className="ios-group">
          <div className="ios-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <span style={{ fontWeight: 500, fontSize: '0.94rem' }}>{dict.settings.themeLabel}</span>
            <div className="ios-segmented" role="radiogroup" aria-label={dict.settings.themeLabel}>
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === t.id}
                  className={`ios-segmented-btn${settings.theme === t.id ? ' is-active' : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ios-row">
            <label htmlFor="omni-lang-select" style={{ fontWeight: 500, fontSize: '0.94rem' }}>
              {dict.settings.languageLabel}
            </label>
            <select
              id="omni-lang-select"
              value={settings.locale}
              onChange={(e) => setLocale(e.target.value as 'tr' | 'en' | 'de' | 'es')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.92rem',
                fontWeight: 500,
                textAlign: 'right',
                cursor: 'pointer',
              }}
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc.code} value={loc.code} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Storage */}
      <section>
        <h2 className="section-header">{dict.settings.storageSection}</h2>
        <div className="ios-group">
          <div className="ios-row">
            <span style={{ fontWeight: 500, fontSize: '0.94rem' }}>{dict.settings.cacheSize}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
              {formatFileSize(cacheBytes)}
            </span>
          </div>

          <button
            type="button"
            className="ios-row ios-row-interactive"
            onClick={() => void clearTempCache()}
          >
            <span style={{ fontWeight: 500, fontSize: '0.94rem', color: 'var(--accent)' }}>
              {dict.settings.clearCache}
            </span>
          </button>

          <button
            type="button"
            className="ios-row ios-row-interactive"
            onClick={() => setConfirmReset(true)}
          >
            <span style={{ fontWeight: 500, fontSize: '0.94rem', color: 'var(--red-text)' }}>
              {dict.settings.resetAllData}
            </span>
          </button>
        </div>

        {confirmReset && (
          <div className="card" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 500 }}>{dict.settings.resetConfirm}</div>
            <div className="grid-2">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                {dict.offlineLock.cancel}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setConfirmReset(false);
                  void resetAllLocalData();
                }}
              >
                {dict.settings.resetAllData}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* About & Legal */}
      <section>
        <h2 className="section-header">{dict.settings.aboutSection}</h2>
        <div className="ios-group">
          <button
            type="button"
            className="ios-row ios-row-interactive"
            data-testid="open-licenses-btn"
            onClick={() => setLicensesOpen(true)}
          >
            <span style={{ fontWeight: 500, fontSize: '0.94rem' }}>
              {dict.settings.openSourceLicenses}
            </span>
            <ChevronRight size={17} color="var(--text-muted)" />
          </button>

          <a
            href={APP_CONFIG.privacyPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ios-row ios-row-interactive"
          >
            <span style={{ fontWeight: 500, fontSize: '0.94rem' }}>
              {dict.settings.privacyPolicy}
            </span>
            <ChevronRight size={17} color="var(--text-muted)" />
          </a>

          <a
            href={APP_CONFIG.termsOfUseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ios-row ios-row-interactive"
          >
            <span style={{ fontWeight: 500, fontSize: '0.94rem' }}>
              {dict.settings.termsOfUse}
            </span>
            <ChevronRight size={17} color="var(--text-muted)" />
          </a>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 14 }}>
          {dict.appName} • {dict.settings.versionLabel} {APP_CONFIG.version}
        </div>
      </section>

      {/* Open Source Licenses Modal */}
      {licensesOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dict.settings.openSourceLicenses}>
          <div className="modal-sheet">
            <div className="sheet-grabber" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                {dict.settings.openSourceLicenses}
              </h2>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 34, height: 34, minHeight: 34, padding: 0, borderRadius: '50%' }}
                onClick={() => setLicensesOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="ios-group" style={{ background: 'var(--sheet-card)' }}>
              {OPEN_SOURCE_NOTICES.map((item) => (
                <div key={item.name} className="ios-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.license}</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{item.purpose}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

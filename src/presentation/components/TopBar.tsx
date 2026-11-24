import React from 'react';
import { Crown, WifiOff } from 'lucide-react';
import { useApp } from '../../application/AppContext';

export const TopBar: React.FC = () => {
  const { activeTab, settings, dict, entitlements, setPaywallOpen, toggleOfflineOnlyMode } = useApp();
  const isOffline = settings.offlineOnlyMode;

  const pageTitle =
    activeTab === 'convert'
      ? dict.nav.convert
      : activeTab === 'queue'
        ? dict.nav.queue
        : activeTab === 'history'
          ? dict.nav.history
          : dict.nav.settings;

  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <h1 className="nav-large-title truncate">{pageTitle}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!entitlements.isPro && (
            <button
              type="button"
              onClick={() => setPaywallOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '8px 13px',
                minHeight: 40,
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontWeight: 700,
                fontSize: '0.82rem',
                whiteSpace: 'nowrap',
              }}
            >
              <Crown size={14} strokeWidth={2.2} />
              <span>{dict.badges.proTag}</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleOfflineOnlyMode}
            aria-pressed={isOffline}
            aria-label={dict.offlineLock.ariaToggle}
            data-testid="offline-lock-toggle"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 13px',
              minHeight: 40,
              borderRadius: 'var(--radius-full)',
              border: '0.5px solid var(--separator-strong)',
              background: isOffline ? 'var(--green-soft)' : 'var(--bg-fill)',
              color: isOffline ? 'var(--green-text)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              transition: 'background-color 0.18s ease, color 0.18s ease',
            }}
          >
            <WifiOff size={15} strokeWidth={2.1} />
            <span>{dict.offlineLock.activeShort}</span>
          </button>
        </div>
      </div>

      {isOffline && (
        <div
          role="status"
          data-testid="offline-lock-banner"
          style={{
            maxWidth: 720,
            margin: '8px auto 0 auto',
            fontSize: '0.78rem',
            color: 'var(--green-text)',
            fontWeight: 500,
          }}
        >
          {dict.offlineLock.bannerActive}
        </div>
      )}
    </header>
  );
};

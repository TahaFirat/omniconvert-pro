import React from 'react';
import { WifiOff } from 'lucide-react';
import { useApp } from '../../application/AppContext';

export const TopBar: React.FC = () => {
  const { activeTab, settings, dict, toggleOfflineOnlyMode } = useApp();
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
        <h1 className="nav-large-title">{pageTitle}</h1>

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
            padding: '7px 12px',
            minHeight: 34,
            borderRadius: 'var(--radius-full)',
            border: '0.5px solid var(--separator-strong)',
            background: isOffline ? 'var(--green-soft)' : 'var(--bg-fill)',
            color: isOffline ? 'var(--green-text)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.78rem',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: 'background-color 0.18s ease, color 0.18s ease',
          }}
        >
          <WifiOff size={14} strokeWidth={2.1} />
          <span>{dict.offlineLock.activeShort}</span>
        </button>
      </div>

      {isOffline && (
        <div
          role="status"
          data-testid="offline-lock-banner"
          style={{
            maxWidth: 680,
            margin: '6px auto 0 auto',
            fontSize: '0.76rem',
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

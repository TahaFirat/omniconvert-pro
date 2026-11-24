import React, { useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import { AppProvider, useApp } from './application/AppContext';
import { BottomNav } from './presentation/components/BottomNav';
import { TopBar } from './presentation/components/TopBar';
import { ConvertScreen } from './presentation/screens/ConvertScreen';
import { HistoryPresetsScreen } from './presentation/screens/HistoryPresetsScreen';
import { PaywallModal } from './presentation/screens/PaywallModal';
import { QueueScreen } from './presentation/screens/QueueScreen';
import { SettingsScreen } from './presentation/screens/SettingsScreen';

const AppShell: React.FC = () => {
  const { activeTab, toastMessage, reviewPromptVisible, dismissReviewPrompt, dict } = useApp();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  return (
    <div className="app-shell">
      <TopBar />

      <div ref={scrollRef} className="scroll-viewport">
        <main className="main-content">
          {activeTab === 'convert' && <ConvertScreen />}
          {activeTab === 'queue' && <QueueScreen />}
          {activeTab === 'history' && <HistoryPresetsScreen />}
          {activeTab === 'settings' && <SettingsScreen />}
        </main>
      </div>

      <BottomNav />
      <PaywallModal />

      {/* Natural 5-Star In-App Review Prompt ONLY after 3rd successful on-device conversion */}
      {reviewPromptVisible && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dict.reviewPrompt.title}>
          <div className="modal-sheet" style={{ maxWidth: 420 }}>
            <div className="modal-sheet-header">
              <div className="sheet-grabber" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.08rem' }}>
                <Star size={20} color="#F59E0B" fill="#F59E0B" />
                <span>{dict.reviewPrompt.title}</span>
              </div>
            </div>
            <div className="modal-sheet-body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {dict.reviewPrompt.body}
              </p>
              <div className="grid-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => dismissReviewPrompt(false)}
                >
                  {dict.reviewPrompt.later}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => dismissReviewPrompt(true)}
                >
                  {dict.reviewPrompt.rateNow}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-intrusive Top Toast — never blocks bottom buttons or tab bar */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 'calc(var(--safe-top) + 68px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 140,
            pointerEvents: 'none',
            maxWidth: 'calc(100vw - 32px)',
            padding: '10px 18px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-surface-secondary)',
            color: 'var(--text-primary)',
            border: '0.5px solid var(--separator-strong)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            fontSize: '0.86rem',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.34)',
            textAlign: 'center',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => (
  <AppProvider>
    <AppShell />
  </AppProvider>
);

export default App;

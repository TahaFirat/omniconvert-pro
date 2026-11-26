import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Star } from 'lucide-react';
import { AppProvider, useApp } from './application/AppContext';
import { interpolate } from './core/i18n';
import { BottomNav } from './presentation/components/BottomNav';
import { TopBar } from './presentation/components/TopBar';
import { ConvertScreen } from './presentation/screens/ConvertScreen';
import { HistoryPresetsScreen } from './presentation/screens/HistoryPresetsScreen';
import { PaywallModal } from './presentation/screens/PaywallModal';
import { QueueScreen } from './presentation/screens/QueueScreen';
import { SettingsScreen } from './presentation/screens/SettingsScreen';
import { ToolWorkspaceSheet } from './presentation/screens/ToolWorkspaceSheet';

const AppShell: React.FC = () => {
  const {
    activeTab,
    activeWorkspace,
    openWorkspace,
    closeWorkspace,
    selectedInputs,
    toastMessage,
    reviewPromptVisible,
    dismissReviewPrompt,
    dict,
  } = useApp();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const sharedOverlays = (
    <>
      <PaywallModal />

      {/* Natural 5-Star In-App Review Prompt ONLY after 3rd successful on-device conversion */}
      {reviewPromptVisible &&
        createPortal(
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
          </div>,
          document.body,
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
            zIndex: 9900,
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
    </>
  );

  // Mutually Exclusive Full-Screen Tool Workspace:
  // TopBar and BottomNav are NOT mounted at all — ZERO overlap is physically possible!
  if (activeWorkspace) {
    return (
      <div className="app-shell">
        <ToolWorkspaceSheet
          toolId={activeWorkspace.toolId}
          initialTarget={activeWorkspace.target}
          initialOptions={activeWorkspace.options}
          onClose={closeWorkspace}
          embeddedInShell
        />
        {sharedOverlays}
      </div>
    );
  }

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

      {/* Dedicated Non-Overlapping Action Dock strictly ABOVE BottomNav when files are selected */}
      {activeTab === 'convert' && selectedInputs.length > 0 && (
        <div className="convert-dock">
          <div className="convert-dock-inner">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              data-testid="choose-target-btn"
              style={{ width: '100%' }}
              onClick={() => openWorkspace({ toolId: 'universal' })}
            >
              {selectedInputs.length === 1
                ? dict.convert.chooseTarget
                : interpolate(dict.convert.convertCount, { count: selectedInputs.length })}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
      {sharedOverlays}
    </div>
  );
};

export const App: React.FC = () => (
  <AppProvider>
    <AppShell />
  </AppProvider>
);

export default App;

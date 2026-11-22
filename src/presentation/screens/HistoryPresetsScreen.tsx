import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { formatFileSize } from '../components/formatBytes';

export const HistoryPresetsScreen: React.FC = () => {
  const {
    dict,
    history,
    clearHistory,
    customPresets,
    deleteCustomPreset,
    setActiveTab,
  } = useApp();

  const [query, setQuery] = useState('');

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (rec) =>
        rec.sourceFileName.toLowerCase().includes(q) ||
        rec.sourceFormat.includes(q) ||
        rec.targetFormat.includes(q),
    );
  }, [history, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search Bar */}
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
          placeholder={dict.history.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Saved Custom Presets */}
      {customPresets.length > 0 && (
        <section>
          <h2 className="section-header">{dict.history.customPresets}</h2>
          <div className="ios-group">
            {customPresets.map((p) => (
              <div key={p.id} className="ios-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="truncate" style={{ fontWeight: 500, fontSize: '0.92rem' }}>
                    {p.customName}
                  </div>
                  <div className="truncate" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {p.description}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ minHeight: 32, padding: '4px 8px', fontSize: '0.82rem' }}
                    onClick={() => setActiveTab('convert')}
                  >
                    {dict.history.applyPreset}
                  </button>
                  <button
                    type="button"
                    aria-label={dict.history.deletePreset}
                    onClick={() => deleteCustomPreset(p.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--red-text)',
                      padding: 4,
                      display: 'inline-flex',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Conversion History */}
      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px 8px 14px',
          }}
        >
          <h2 className="section-header" style={{ padding: 0, margin: 0 }}>
            {dict.history.recentJobs}
          </h2>
          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: '0.8rem',
                fontWeight: 500,
                padding: 0,
              }}
            >
              {dict.history.clearAll}
            </button>
          )}
        </div>

        {filteredHistory.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              {dict.history.noHistory}
            </div>
          </div>
        ) : (
          <div className="ios-group">
            {filteredHistory.map((rec) => (
              <div key={rec.id} className="ios-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="truncate" style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    {rec.sourceFileName}
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginTop: 2,
                    }}
                  >
                    {rec.stepsChain.map((step, idx) => (
                      <React.Fragment key={`${rec.id}-${idx}`}>
                        {idx > 0 && <ArrowRight size={11} />}
                        <span>{step.toUpperCase()}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                    {formatFileSize(rec.outputBytes)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {rec.tier === 3 ? dict.badges.cloudShort : dict.badges.localShort}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

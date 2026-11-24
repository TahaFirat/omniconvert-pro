import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { interpolate } from '../../core/i18n';
import { formatFileSize } from '../components/formatBytes';

type SortMode = 'newest' | 'oldest' | 'name' | 'size';

export const HistoryPresetsScreen: React.FC = () => {
  const {
    dict,
    history,
    clearHistory,
    deleteHistoryItems,
    customPresets,
    deleteCustomPreset,
    launchCustomPreset,
  } = useApp();

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('newest');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? history.filter(
          (rec) =>
            rec.sourceFileName.toLowerCase().includes(q) ||
            rec.sourceFormat.includes(q) ||
            rec.targetFormat.includes(q),
        )
      : [...history];

    list.sort((a, b) => {
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      if (sortBy === 'name') return a.sourceFileName.localeCompare(b.sourceFileName);
      if (sortBy === 'size') return b.outputBytes - a.outputBytes;
      return b.timestamp - a.timestamp;
    });
    return list;
  }, [history, query, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    deleteHistoryItems(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelecting(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search + Sort Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

        {history.length > 1 && (
          <div className="ios-segmented">
            {(
              [
                ['newest', dict.history.sortNewest],
                ['oldest', dict.history.sortOldest],
                ['name', dict.history.sortName],
                ['size', dict.history.sortSize],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`ios-segmented-btn${sortBy === mode ? ' is-active' : ''}`}
                onClick={() => setSortBy(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
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
                    className="btn btn-secondary"
                    style={{ minHeight: 40, padding: '6px 12px', fontSize: '0.82rem' }}
                    onClick={() => launchCustomPreset(p)}
                  >
                    {dict.history.applyPreset}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={dict.history.deletePreset}
                    onClick={() => deleteCustomPreset(p.id)}
                    style={{ background: 'var(--red-soft)', color: 'var(--red-text)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Conversion History (Sortable + Multi-Select Bulk Delete) */}
      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px 8px 14px',
            gap: 8,
          }}
        >
          <h2 className="section-header" style={{ padding: 0, margin: 0 }}>
            {dict.history.recentJobs}
          </h2>
          {history.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setSelecting((v) => !v);
                  setSelectedIds(new Set());
                }}
                style={{
                  minHeight: 38,
                  padding: '6px 8px',
                  color: 'var(--accent)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              >
                {selecting ? dict.history.doneSelect : dict.history.selectMode}
              </button>
              {!selecting && (
                <button
                  type="button"
                  onClick={clearHistory}
                  style={{
                    minHeight: 38,
                    padding: '6px 8px',
                    color: 'var(--text-muted)',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                  }}
                >
                  {dict.history.clearAll}
                </button>
              )}
            </div>
          )}
        </div>

        {selecting && selectedIds.size > 0 && (
          <button
            type="button"
            className="btn btn-danger"
            style={{ width: '100%', marginBottom: 10, minHeight: 40 }}
            onClick={handleBulkDelete}
          >
            <Trash2 size={15} />
            <span>{interpolate(dict.history.deleteSelected, { count: selectedIds.size })}</span>
          </button>
        )}

        {filteredHistory.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              {dict.history.noHistory}
            </div>
          </div>
        ) : (
          <div className="ios-group">
            {filteredHistory.map((rec) => {
              const isChecked = selectedIds.has(rec.id);
              return (
                <div
                  key={rec.id}
                  className={selecting ? 'ios-row ios-row-interactive' : 'ios-row'}
                  onClick={selecting ? () => toggleSelect(rec.id) : undefined}
                  style={{ cursor: selecting ? 'pointer' : 'default' }}
                >
                  {selecting && (
                    <span style={{ color: isChecked ? 'var(--accent)' : 'var(--text-muted)', display: 'inline-flex' }}>
                      {isChecked ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </span>
                  )}
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
                      {dict.badges.localShort}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

import React from 'react';
import { ArrowLeftRight, Clock, Layers, Settings } from 'lucide-react';
import { useApp, type ActiveTab } from '../../application/AppContext';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, activeJobsCount, hasFullscreenOverlay, dict } = useApp();

  if (hasFullscreenOverlay) return null;

  const items: Array<{ id: ActiveTab; label: string; icon: (active: boolean) => React.ReactNode; badge?: number }> = [
    {
      id: 'convert',
      label: dict.nav.convert,
      icon: (a) => <ArrowLeftRight size={20} strokeWidth={a ? 2.25 : 1.75} />,
    },
    {
      id: 'queue',
      label: dict.nav.queue,
      icon: (a) => <Layers size={20} strokeWidth={a ? 2.25 : 1.75} />,
      badge: activeJobsCount > 0 ? activeJobsCount : undefined,
    },
    {
      id: 'history',
      label: dict.nav.history,
      icon: (a) => <Clock size={20} strokeWidth={a ? 2.25 : 1.75} />,
    },
    {
      id: 'settings',
      label: dict.nav.settings,
      icon: (a) => <Settings size={20} strokeWidth={a ? 2.25 : 1.75} />,
    },
  ];

  return (
    <div className="bottom-nav-wrap">
      <nav className="liquid-glass-nav" aria-label="Tab bar">
        {items.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={active ? 'page' : undefined}
              data-testid={`nav-${item.id}`}
              className={`liquid-tab-btn${active ? ' is-active' : ''}`}
            >
              {item.icon(active)}
              <span className="truncate" style={{ maxWidth: '100%' }}>
                {item.label}
              </span>
              {item.badge !== undefined && (
                <span className="liquid-tab-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

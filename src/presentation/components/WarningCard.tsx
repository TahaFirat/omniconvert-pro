import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import type { WarningCode } from '../../domain/entities/format';

interface WarningCardProps {
  codes: WarningCode[];
}

export const WarningCard: React.FC<WarningCardProps> = ({ codes }) => {
  const { dict } = useApp();
  if (codes.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {codes.map((code) => {
        const isBlock = code.startsWith('BLOCK_');
        const bg = isBlock ? 'var(--red-soft)' : 'var(--orange-soft)';
        const color = isBlock ? 'var(--red-text)' : 'var(--orange-text)';
        const Icon = code === 'BLOCK_ENCRYPTED' ? Lock : AlertCircle;

        return (
          <div
            key={code}
            role="alert"
            data-testid={`warning-${code}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: bg,
              color,
              fontSize: '0.82rem',
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{dict.warnings[code]}</span>
          </div>
        );
      })}
    </div>
  );
};

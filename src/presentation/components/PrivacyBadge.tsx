import React from 'react';
import { Cloud, Smartphone } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import type { ConversionTier } from '../../domain/entities/format';

interface PrivacyBadgeProps {
  tier: ConversionTier;
  compact?: boolean;
}

export const PrivacyBadge: React.FC<PrivacyBadgeProps> = ({ tier, compact = false }) => {
  const { dict } = useApp();
  const isLocal = tier === 1 || tier === 2;

  if (isLocal) {
    return (
      <span className="tag tag-local">
        <Smartphone size={11} strokeWidth={2.2} />
        <span>{compact ? dict.badges.localShort : dict.badges.localTitle}</span>
      </span>
    );
  }

  return (
    <span className="tag tag-cloud">
      <Cloud size={11} strokeWidth={2.2} />
      <span>{compact ? dict.badges.cloudShort : dict.badges.cloudTitle}</span>
    </span>
  );
};

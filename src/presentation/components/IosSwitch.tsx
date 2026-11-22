import React from 'react';

interface IosSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}

export const IosSwitch: React.FC<IosSwitchProps> = ({ checked, onChange, ariaLabel }) => (
  <label className="ios-switch">
    <input
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="ios-switch-track" aria-hidden="true" />
    <span className="ios-switch-thumb" aria-hidden="true" />
  </label>
);

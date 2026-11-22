import React from 'react';
import type { SelectedInputItem } from '../../application/AppContext';
import type { ConversionOptions } from '../../domain/entities/job';
import { ToolWorkspaceSheet } from './ToolWorkspaceSheet';

interface TargetPickerSheetProps {
  inputs?: SelectedInputItem[];
  initialTarget?: string;
  initialOptions?: Partial<ConversionOptions>;
  onClose: () => void;
}

export const TargetPickerSheet: React.FC<TargetPickerSheetProps> = ({
  initialTarget,
  initialOptions,
  onClose,
}) => (
  <ToolWorkspaceSheet
    toolId="universal"
    initialTarget={initialTarget}
    initialOptions={initialOptions}
    onClose={onClose}
  />
);

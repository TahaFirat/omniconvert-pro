import type { ConversionOptions } from './job';

export interface ConversionPreset {
  id: string;
  nameKey?: 'whatsappShrink' | 'edevletPdf' | 'webOptimize' | 'losslessArchive' | 'ocrScan';
  customName?: string;
  description?: string;
  targetFormat: string;
  compatibleCategories: string[];
  options: Partial<ConversionOptions>;
  isBuiltIn: boolean;
  createdAt: number;
}

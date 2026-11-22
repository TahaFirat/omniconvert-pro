import type { ConversionOptions } from './job';

export interface ConversionPreset {
  id: string;
  nameKey?: 'whatsappShrink' | 'edevletPdf' | 'pdfStudio' | 'videoAudio' | 'videoGif' | 'ocrScan';
  customName?: string;
  description?: string;
  targetFormat: string;
  compatibleCategories: string[];
  options: Partial<ConversionOptions>;
  isBuiltIn: boolean;
  createdAt: number;
}

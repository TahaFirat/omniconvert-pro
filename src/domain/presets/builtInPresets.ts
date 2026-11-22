import type { ConversionPreset } from '../entities/preset';

export const BUILT_IN_PRESETS: readonly ConversionPreset[] = [
  {
    id: 'preset_whatsapp_shrink',
    nameKey: 'whatsappShrink',
    targetFormat: 'jpg',
    compatibleCategories: ['image', 'video'],
    options: {
      quality: 78,
      maxDimension: 1280,
      stripExif: true,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'preset_edevlet_pdf',
    nameKey: 'edevletPdf',
    targetFormat: 'pdf',
    compatibleCategories: ['image', 'document', 'pdf'],
    options: {
      quality: 76,
      dpi: 150,
      maxDimension: 1654,
      stripExif: true,
      mergeIntoSinglePdf: true,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'preset_web_optimize',
    nameKey: 'webOptimize',
    targetFormat: 'webp',
    compatibleCategories: ['image'],
    options: {
      quality: 82,
      maxDimension: 1920,
      stripExif: true,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'preset_lossless_archive',
    nameKey: 'losslessArchive',
    targetFormat: 'zip',
    compatibleCategories: ['image', 'pdf', 'document', 'data', 'archive', 'audio'],
    options: {
      quality: 100,
      stripExif: false,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'preset_ocr_scan',
    nameKey: 'ocrScan',
    targetFormat: 'txt',
    compatibleCategories: ['image', 'pdf'],
    options: {
      ocrLanguage: 'tr',
      stripExif: true,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
];

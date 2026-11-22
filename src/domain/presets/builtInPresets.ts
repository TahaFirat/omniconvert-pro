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
    compatibleCategories: ['image', 'document'],
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
    id: 'preset_pdf_studio',
    nameKey: 'pdfStudio',
    targetFormat: 'pdf',
    compatibleCategories: ['pdf'],
    options: {
      stripExif: true,
      mergeIntoSinglePdf: true,
      pdfRotateDegrees: 0,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'preset_video_audio',
    nameKey: 'videoAudio',
    targetFormat: 'm4a',
    compatibleCategories: ['video', 'audio'],
    options: {
      ringtoneDurationSec: 30,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'preset_video_gif',
    nameKey: 'videoGif',
    targetFormat: 'gif',
    compatibleCategories: ['video'],
    options: {
      maxDimension: 480,
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

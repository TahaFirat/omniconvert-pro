import type { ConversionOptions } from '../entities/job';

export type ToolCategory = 'all' | 'pdf' | 'image' | 'media' | 'doc';

export type GuidedToolId =
  | 'pdf-merge'
  | 'images-to-pdf'
  | 'pdf-tools'
  | 'image-convert'
  | 'video-audio'
  | 'video-compress'
  | 'ocr-extract'
  | 'doc-data'
  | 'universal';

export type ToolCopyKey =
  | 'pdfMerge'
  | 'imagesToPdf'
  | 'pdfTools'
  | 'imageConvert'
  | 'videoAudio'
  | 'videoCompress'
  | 'ocrExtract'
  | 'docData';

export interface GuidedToolSpec {
  id: Exclude<GuidedToolId, 'universal'>;
  copyKey: ToolCopyKey;
  category: Exclude<ToolCategory, 'all'>;
  accentColor: string;
  accentBg: string;
  accept: string;
  multiple: boolean;
  defaultTarget: string;
  quickTargets: string[];
  defaultOptions: Partial<ConversionOptions>;
  requiresMinFiles?: number;
  isProHighlight?: boolean;
}

export const GUIDED_TOOLS: readonly GuidedToolSpec[] = [
  {
    id: 'pdf-merge',
    copyKey: 'pdfMerge',
    category: 'pdf',
    accentColor: 'var(--red)',
    accentBg: 'var(--red-soft)',
    accept: '.pdf,application/pdf,image/*',
    multiple: true,
    defaultTarget: 'pdf',
    quickTargets: ['pdf'],
    defaultOptions: {
      mergeIntoSinglePdf: true,
      stripExif: true,
    },
    requiresMinFiles: 2,
    isProHighlight: true,
  },
  {
    id: 'images-to-pdf',
    copyKey: 'imagesToPdf',
    category: 'pdf',
    accentColor: 'var(--orange)',
    accentBg: 'var(--orange-soft)',
    accept: 'image/*,.heic,.heif,.png,.jpg,.jpeg,.webp,.bmp',
    multiple: true,
    defaultTarget: 'pdf',
    quickTargets: ['pdf'],
    defaultOptions: {
      mergeIntoSinglePdf: true,
      quality: 82,
      dpi: 150,
      stripExif: true,
    },
  },
  {
    id: 'pdf-tools',
    copyKey: 'pdfTools',
    category: 'pdf',
    accentColor: 'var(--purple)',
    accentBg: 'var(--purple-soft)',
    accept: '.pdf,application/pdf',
    multiple: false,
    defaultTarget: 'pdf',
    quickTargets: ['pdf', 'png', 'jpg', 'txt'],
    defaultOptions: {
      stripExif: true,
      pdfRotateDegrees: 0,
    },
    isProHighlight: true,
  },
  {
    id: 'image-convert',
    copyKey: 'imageConvert',
    category: 'image',
    accentColor: 'var(--accent)',
    accentBg: 'var(--accent-soft)',
    accept: 'image/*,.heic,.heif,.dng,.cr2,.nef,.arw,.tiff,.svg',
    multiple: true,
    defaultTarget: 'jpg',
    quickTargets: ['jpg', 'png', 'webp', 'pdf', 'bmp', 'ico'],
    defaultOptions: {
      quality: 85,
      stripExif: true,
    },
  },
  {
    id: 'video-audio',
    copyKey: 'videoAudio',
    category: 'media',
    accentColor: 'var(--pink)',
    accentBg: 'var(--pink-soft)',
    accept: 'video/*,audio/*,.mp4,.mov,.m4v,.m4a,.wav,.mp3',
    multiple: false,
    defaultTarget: 'm4a',
    quickTargets: ['m4a', 'm4r', 'wav'],
    defaultOptions: {
      ringtoneDurationSec: 30,
    },
    isProHighlight: true,
  },
  {
    id: 'video-compress',
    copyKey: 'videoCompress',
    category: 'media',
    accentColor: 'var(--indigo)',
    accentBg: 'var(--indigo-soft)',
    accept: 'video/*,.mp4,.mov,.m4v',
    multiple: false,
    defaultTarget: 'mp4',
    quickTargets: ['mp4', 'mov', 'gif'],
    defaultOptions: {
      videoResolution: '720p',
      maxDimension: 480,
    },
    isProHighlight: true,
  },
  {
    id: 'ocr-extract',
    copyKey: 'ocrExtract',
    category: 'doc',
    accentColor: 'var(--green)',
    accentBg: 'var(--green-soft)',
    accept: 'image/*,.pdf,application/pdf',
    multiple: false,
    defaultTarget: 'txt',
    quickTargets: ['txt'],
    defaultOptions: {
      ocrLanguage: 'tr',
      stripExif: true,
    },
    isProHighlight: true,
  },
  {
    id: 'doc-data',
    copyKey: 'docData',
    category: 'doc',
    accentColor: 'var(--teal)',
    accentBg: 'var(--teal-soft)',
    accept: '.docx,.xlsx,.ods,.epub,.md,.html,.rtf,.txt,.json,.yaml,.yml,.toml,.xml,.csv,.tsv,.zip,.tar,.gz,.tgz',
    multiple: true,
    defaultTarget: 'pdf',
    quickTargets: [],
    defaultOptions: {
      stripExif: true,
    },
  },
];

export function getGuidedTool(toolId: GuidedToolId): GuidedToolSpec | null {
  if (toolId === 'universal') return null;
  return GUIDED_TOOLS.find((t) => t.id === toolId) ?? null;
}

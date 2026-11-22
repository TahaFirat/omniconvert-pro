export type FormatCategory =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'document'
  | 'ebook'
  | 'archive'
  | 'data'
  | 'model3d'
  | 'cad'
  | 'font';

export type ConversionTier = 1 | 2 | 3;

export type WarningCode =
  | 'WARN_RASTERIZE'
  | 'WARN_FLATTEN_LAYERS'
  | 'WARN_LAYOUT_SHIFT'
  | 'WARN_LOSSY_REENCODE'
  | 'BLOCK_ENCRYPTED'
  | 'BLOCK_DRM'
  | 'BLOCK_OFFLINE_LOCK';

export type EngineId =
  | 'ios_imageio'
  | 'ios_avfoundation'
  | 'ios_pdfkit'
  | 'ios_vision_ocr'
  | 'local_image'
  | 'local_pdf'
  | 'local_archive'
  | 'local_data'
  | 'local_audio'
  | 'cloud_libreoffice'
  | 'cloud_pandoc'
  | 'cloud_calibre'
  | 'cloud_imagemagick'
  | 'cloud_inkscape'
  | 'cloud_ghostscript'
  | 'cloud_ffmpeg'
  | 'cloud_assimp'
  | 'cloud_cad'
  | 'cloud_fontforge'
  | 'cloud_archive'
  | 'cloud_data';

export interface FormatDescriptor {
  id: string;
  extension: string;
  label: string;
  mime: string;
  category: FormatCategory;
  description: string;
  defaultTier: ConversionTier;
  isLossy?: boolean;
  isVector?: boolean;
  isPlainText?: boolean;
  popularTargets: string[];
}

export interface ConversionEdge {
  source: string;
  target: string;
  engineId: EngineId;
  tier: ConversionTier;
  latencyMsEst: number;
  qualityLoss: number; // 0 (lossless) to 100
  warningCode?: WarningCode;
}

export interface FileInspectionResult {
  fileName: string;
  fileSizeBytes: number;
  claimedExtension: string;
  detectedFormatId: string;
  detectedMime: string;
  confidence: 'magic_bytes' | 'zip_container' | 'text_heuristic' | 'extension_fallback';
  isExtensionMismatch: boolean;
  isEncrypted: boolean;
  hasDrm: boolean;
  warnings: WarningCode[];
  summaryMeta?: {
    containerEntries?: number;
    headerHex?: string;
  };
}

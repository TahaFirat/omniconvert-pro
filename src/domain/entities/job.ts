import type { ConversionTier, EngineId, FileInspectionResult, WarningCode } from './format';

export interface ConversionOptions {
  quality: number; // 10..100
  maxDimension?: number; // px, optional resize cap
  dpi?: number; // 72..300
  stripExif: boolean;
  password?: string;
  ocrLanguage: 'tr' | 'en' | 'de' | 'es';
  mergeIntoSinglePdf?: boolean;
  sampleRate?: number; // audio resampling
}

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  quality: 85,
  stripExif: true,
  ocrLanguage: 'tr',
  dpi: 150,
  mergeIntoSinglePdf: false,
};

export interface ConversionStep {
  source: string;
  target: string;
  engineId: EngineId;
  tier: ConversionTier;
  latencyMsEst: number;
  qualityLoss: number;
  warningCode?: WarningCode;
}

export interface ConversionPlan {
  sourceFormat: string;
  targetFormat: string;
  steps: ConversionStep[];
  highestTier: ConversionTier;
  requiresCloud: boolean;
  totalWeight: number;
  estimatedMs: number;
  warnings: WarningCode[];
  blockedByOfflineLock: boolean;
  blockedReason?: WarningCode;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ConversionOutput {
  fileName: string;
  mime: string;
  formatId: string;
  sizeBytes: number;
  blob?: Blob;
  nativeUri?: string;
  previewText?: string;
}

export interface ConversionJob {
  id: string;
  createdAt: number;
  completedAt?: number;
  file: File;
  inspection: FileInspectionResult;
  targetFormat: string;
  plan: ConversionPlan;
  options: ConversionOptions;
  allowCloudOverride: boolean;
  status: JobStatus;
  progress: number; // 0..100
  stageLabel: string;
  etaSeconds?: number;
  output?: ConversionOutput;
  errorMessage?: string;
  errorCode?: string;
  cloudWiped?: boolean;
  creditRefunded?: boolean;
}

export interface ConversionHistoryRecord {
  id: string;
  timestamp: number;
  sourceFileName: string;
  sourceFormat: string;
  targetFormat: string;
  sourceBytes: number;
  outputBytes: number;
  tier: ConversionTier;
  stepsChain: string[];
  status: 'completed' | 'failed' | 'cancelled';
  durationMs: number;
  strippedExif: boolean;
}

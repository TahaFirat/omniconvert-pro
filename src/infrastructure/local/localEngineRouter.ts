import { JobCancelledError, OmniError } from '../../core/errors';
import type { ConversionOptions, ConversionStep } from '../../domain/entities/job';
import { isNativeIos, OmniNativeEngine, uint8ToBase64 } from '../native/omniNativeBridge';
import { convertArchiveLocally } from './localArchiveConverter';
import { convertAudioLocally } from './localAudioConverter';
import { convertDataLocally } from './localDataConverter';
import { convertImageLocally } from './localImageConverter';
import {
  convertPdfOutputLocally,
  imagesToPdfLocally,
  textToPdfLocally,
} from './localPdfConverter';

export interface LocalStepResult {
  blob: Blob;
  mime: string;
  previewText?: string;
}

/**
 * Executes a single Tier 1 (Native Hardware) or Tier 2 (On-Device Local) conversion step.
 * Respects cooperative cancellation via AbortSignal.
 */
export async function executeLocalStep(params: {
  inputBlob: Blob;
  fileName: string;
  step: ConversionStep;
  options: ConversionOptions;
  signal: AbortSignal;
}): Promise<LocalStepResult> {
  const { inputBlob, fileName, step, options, signal } = params;
  if (signal.aborted) {
    throw new JobCancelledError(fileName);
  }

  switch (step.engineId) {
    case 'ios_imageio':
    case 'local_image':
      return convertImageLocally(inputBlob, step.source, step.target, options);

    case 'local_pdf':
      if (step.source === 'txt' || step.source === 'md') {
        const text = await inputBlob.text();
        return textToPdfLocally(text, options);
      }
      return imagesToPdfLocally([{ blob: inputBlob, formatId: step.source }], options);

    case 'ios_pdfkit':
      return convertPdfOutputLocally(inputBlob, step.target, options);

    case 'ios_vision_ocr': {
      if (step.source === 'pdf') {
        return convertPdfOutputLocally(inputBlob, 'txt', options);
      }
      if (isNativeIos()) {
        const bytes = new Uint8Array(await inputBlob.arrayBuffer());
        const base64Data = await uint8ToBase64(bytes);
        const res = await OmniNativeEngine.recognizeTextOcr({
          base64Data,
          sourceFormat: step.source,
          language: options.ocrLanguage,
        });
        return {
          blob: new Blob([res.text], { type: 'text/plain;charset=utf-8' }),
          mime: 'text/plain',
          previewText: res.text,
        };
      }
      throw new OmniError(
        'IOS_VISION_REQUIRED',
        'Offline OCR runs natively on-device using Apple Vision (VNRecognizeTextRequest).',
      );
    }

    case 'ios_avfoundation':
      if (!isNativeIos()) {
        if (step.target === 'wav') {
          return convertAudioLocally(inputBlob, 'wav', options);
        }
        throw new OmniError(
          'IOS_AVFOUNDATION_REQUIRED',
          'Hardware H.264/HEVC & AAC transcoding runs via Apple AVFoundation / VideoToolbox on iOS.',
        );
      }
      // On iOS device, convertAudioLocally handles WAV or AVFoundation handles video/M4A
      if (step.target === 'wav') {
        return convertAudioLocally(inputBlob, 'wav', options);
      }
      throw new OmniError(
        'AVFOUNDATION_PATH_REQUIRED',
        'Hardware media conversion requires native file URI via Files picker.',
      );

    case 'local_archive':
      return convertArchiveLocally(inputBlob, fileName, step.source, step.target);

    case 'local_data':
      return convertDataLocally(inputBlob, step.source, step.target);

    case 'local_audio':
      return convertAudioLocally(inputBlob, step.target, options);

    default:
      throw new OmniError(
        'LOCAL_ENGINE_UNSUPPORTED',
        `Engine ${step.engineId} cannot run locally.`,
      );
  }
}

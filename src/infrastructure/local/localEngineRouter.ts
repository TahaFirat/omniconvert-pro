import { Directory, Filesystem } from '@capacitor/filesystem';
import { JobCancelledError, OmniError } from '../../core/errors';
import type { ConversionOptions, ConversionStep } from '../../domain/entities/job';
import {
  base64ToUint8,
  isNativeIos,
  OmniNativeEngine,
  uint8ToBase64,
} from '../native/omniNativeBridge';
import { convertArchiveLocally } from './localArchiveConverter';
import { convertAudioLocally } from './localAudioConverter';
import { convertDataLocally } from './localDataConverter';
import { convertImageLocally } from './localImageConverter';
import {
  convertPdfOutputLocally,
  imagesToPdfLocally,
  textToPdfLocally,
  transformPdfLocally,
} from './localPdfConverter';

export interface LocalStepResult {
  blob: Blob;
  mime: string;
  previewText?: string;
}

/**
 * Stages a binary media Blob to Capacitor's native Cache dir, calls Swift AVFoundation/ImageIO,
 * reads the converted output back, and guarantees zero residual temp files in `finally`.
 */
async function runNativeIosMediaConversion(
  inputBlob: Blob,
  sourceFormat: string,
  targetFormat: string,
  options: ConversionOptions,
): Promise<LocalStepResult> {
  const tempFileName = `omni_media_in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${sourceFormat}`;
  const inputBytes = new Uint8Array(await inputBlob.arrayBuffer());
  const inputB64 = await uint8ToBase64(inputBytes);

  const written = await Filesystem.writeFile({
    path: tempFileName,
    data: inputB64,
    directory: Directory.Cache,
  });
  const nativePath = written.uri.replace(/^file:\/\//, '');

  try {
    if (targetFormat === 'gif') {
      const gifRes = await OmniNativeEngine.videoToGif({
        inputPath: nativePath,
        fps: 10,
        maxDurationSec: 12,
        maxDimension: options.maxDimension ?? 480,
      });
      const outBytes = base64ToUint8(gifRes.base64Data);
      const copy = new Uint8Array(outBytes.byteLength);
      copy.set(outBytes);
      return { blob: new Blob([copy], { type: 'image/gif' }), mime: 'image/gif' };
    }

    const mediaRes = await OmniNativeEngine.convertMedia({
      inputPath: nativePath,
      targetFormat,
      resolution: options.videoResolution ?? '720p',
      maxDurationSec: targetFormat === 'm4r' ? Math.min(30, options.ringtoneDurationSec ?? 30) : undefined,
    });

    if (mediaRes.base64Data) {
      const outBytes = base64ToUint8(mediaRes.base64Data);
      const copy = new Uint8Array(outBytes.byteLength);
      copy.set(outBytes);
      return { blob: new Blob([copy], { type: mediaRes.mime }), mime: mediaRes.mime };
    }

    const readBack = await Filesystem.readFile({ path: mediaRes.outputPath });
    const outBytes = base64ToUint8(String(readBack.data));
    const copy = new Uint8Array(outBytes.byteLength);
    copy.set(outBytes);
    return { blob: new Blob([copy], { type: mediaRes.mime }), mime: mediaRes.mime };
  } finally {
    await Filesystem.deleteFile({ path: tempFileName, directory: Directory.Cache }).catch(() => {});
  }
}

/**
 * Executes a single Tier 1 (Native Hardware) or Tier 2 (On-Device Local) conversion step.
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
      if (step.source === 'pdf' && step.target === 'pdf') {
        return transformPdfLocally(inputBlob, options);
      }
      if (step.source === 'txt' || step.source === 'md') {
        const text = await inputBlob.text();
        return textToPdfLocally(text, options);
      }
      if (['docx', 'rtf', 'html', 'xlsx', 'ods', 'csv'].includes(step.source)) {
        const intermediateTarget = step.source === 'xlsx' || step.source === 'ods' ? 'csv' : 'txt';
        const extracted = await convertDataLocally(inputBlob, step.source, intermediateTarget);
        return textToPdfLocally(extracted.previewText, options);
      }
      if (step.source === 'epub') {
        const extracted = await convertArchiveLocally(inputBlob, fileName, 'epub', 'txt');
        return textToPdfLocally(extracted.previewText ?? '', options);
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
        'Offline OCR runs natively on-device using Apple Vision on iPhone and iPad.',
      );
    }

    case 'ios_avfoundation':
      if (isNativeIos()) {
        return runNativeIosMediaConversion(inputBlob, step.source, step.target, options);
      }
      if (step.target === 'wav') {
        return convertAudioLocally(inputBlob, 'wav', options);
      }
      throw new OmniError(
        'IOS_AVFOUNDATION_REQUIRED',
        'Hardware video/audio conversion runs natively on iPhone and iPad.',
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

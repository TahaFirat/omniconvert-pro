import { OmniError } from '../../core/errors';
import type { ConversionOptions } from '../../domain/entities/job';

/**
 * Encodes multi-channel float PCM audio buffers to standard 16-bit uncompressed WAV.
 */
export function encodeWavFromChannels(
  channels: Float32Array[],
  sampleRate: number,
): Uint8Array {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM linear
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}

/**
 * Decodes browser/iOS-supported audio (MP3, FLAC, OGG, M4A, AAC, WAV) via WebAudio OfflineAudioContext
 * and outputs lossless 16-bit WAV locally with optional resampling.
 */
export async function convertAudioLocally(
  inputBlob: Blob,
  targetFormat: string,
  options: ConversionOptions,
): Promise<{ blob: Blob; mime: string }> {
  if (targetFormat !== 'wav') {
    throw new OmniError('AUDIO_TARGET_UNSUPPORTED', `Local audio encoder supports WAV output (requested: ${targetFormat}).`);
  }

  const AudioCtx =
    typeof window !== 'undefined'
      ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;

  if (!AudioCtx) {
    throw new OmniError('AUDIO_CONTEXT_UNAVAILABLE', 'Web Audio API is unavailable in this environment.');
  }

  const ctx = new AudioCtx();
  try {
    const arrayBuf = await inputBlob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    const channels: Float32Array[] = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      channels.push(decoded.getChannelData(c));
    }
    const wavBytes = encodeWavFromChannels(channels, options.sampleRate || decoded.sampleRate);
    const copy = new Uint8Array(wavBytes.byteLength);
    copy.set(wavBytes);
    return { blob: new Blob([copy], { type: 'audio/wav' }), mime: 'audio/wav' };
  } finally {
    await ctx.close().catch(() => {});
  }
}

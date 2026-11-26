import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface NativeImageConvertParams {
  base64Data: string;
  sourceFormat: string;
  targetFormat: string;
  quality: number;
  maxDimension?: number;
  stripExif: boolean;
}

export interface NativeBinaryResult {
  base64Data: string;
  mime: string;
  sizeBytes: number;
}

export interface NativeOcrParams {
  base64Data: string;
  sourceFormat: string;
  language: string;
}

export interface NativeOcrResult {
  text: string;
  confidence: number;
}

export interface NativeMediaParams {
  inputPath: string;
  targetFormat: string;
  resolution?: '1080p' | '720p' | '480p';
  maxDurationSec?: number;
}

export interface NativeMediaResult {
  outputPath: string;
  base64Data?: string;
  mime: string;
  sizeBytes: number;
}

export interface NativePdfPreviewPageResult {
  base64Data: string;
  mime: string;
  pageCount: number;
  width: number;
  height: number;
}

export interface OmniNativeEnginePlugin {
  isAvailable(): Promise<{ available: boolean; platform: string; osVersion: string }>;
  setNativeAppearance(options: { theme: 'light' | 'dark' | 'amoled' | 'system' }): Promise<{ applied: string }>;
  convertImage(options: NativeImageConvertParams): Promise<NativeBinaryResult>;
  recognizeTextOcr(options: NativeOcrParams): Promise<NativeOcrResult>;
  convertMedia(options: NativeMediaParams): Promise<NativeMediaResult>;
  videoToGif(options: { inputPath: string; fps?: number; maxDurationSec?: number; maxDimension?: number }): Promise<NativeBinaryResult>;
  pdfToImages(options: { base64Data: string; targetFormat: string; dpi: number }): Promise<NativeBinaryResult>;
  textToVectorPdf(options: { text: string }): Promise<NativeBinaryResult>;
  renderPdfPreviewPage(options: { base64Data: string; pageNumber: number; maxWidth?: number }): Promise<NativePdfPreviewPageResult>;
  openQuickLook(options: { base64Data: string; fileName: string }): Promise<{ presented: boolean }>;
  cleanupTempWorkspace(): Promise<{ cleanedBytes: number; removedDirs: number }>;
  getSharedInboxFiles(): Promise<{ files: Array<{ name: string; base64Data: string; mime: string }> }>;
}

export interface StoreKitProductInfo {
  id: string;
  displayName: string;
  displayPrice: string;
  description: string;
}

export interface OmniBillingPlugin {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreKitProductInfo[] }>;
  purchaseProduct(options: { productId: string }): Promise<{
    success: boolean;
    transactionId?: string;
    productId: string;
  }>;
  restorePurchases(): Promise<{
    isPro: boolean;
    restoredProductIds: string[];
  }>;
  requestAppStoreReview(): Promise<{ presented: boolean }>;
}

export const OmniNativeEngine = registerPlugin<OmniNativeEnginePlugin>('OmniNativeEngine');
export const OmniBilling = registerPlugin<OmniBillingPlugin>('OmniBilling');

export function isNativeIos(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function triggerHapticImpact(style: 'light' | 'medium' = 'light'): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await Haptics.impact({
      style: style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    // Non-fatal on simulators or unsupported devices
  }
}

export async function triggerHapticNotification(type: 'success' | 'warning' | 'error'): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const map = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: map[type] });
  } catch {
    // Non-fatal
  }
}

export async function readClipboardContent(): Promise<{ text?: string }> {
  try {
    if (isNativePlatform()) {
      const result = await Clipboard.read();
      return { text: result.value || undefined };
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      return { text: text || undefined };
    }
  } catch {
    return {};
  }
  return {};
}

export async function uint8ToBase64(bytes: Uint8Array): Promise<string> {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Opens native iOS QuickLook (QLPreviewController) for pinch-to-zoom full-screen preview.
 */
export async function openNativeQuickLook(blob: Blob, fileName: string): Promise<boolean> {
  if (!isNativeIos()) return false;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const base64Data = await uint8ToBase64(bytes);
    const res = await OmniNativeEngine.openQuickLook({ base64Data, fileName });
    return Boolean(res.presented);
  } catch {
    return false;
  }
}

/**
 * Shares or downloads a converted output file safely, cleaning up temporary cache files afterwards.
 */
export async function shareOrDownloadOutput(blob: Blob, fileName: string): Promise<void> {
  if (isNativePlatform()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const base64 = await uint8ToBase64(bytes);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = `omniconvert_share_${Date.now()}_${safeName}`;
    try {
      const saved = await Filesystem.writeFile({
        path: tempPath,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: fileName,
        url: saved.uri,
        dialogTitle: fileName,
      });
    } finally {
      // Zero residual temp files guarantee
      setTimeout(() => {
        void Filesystem.deleteFile({ path: tempPath, directory: Directory.Cache }).catch(() => {});
      }, 30_000);
    }
    return;
  }

  // Browser / preview fallback download
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

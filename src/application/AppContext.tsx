import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  DICTIONARIES,
  detectDefaultLocale,
  type Dictionary,
  type LocaleCode,
} from '../core/i18n';
import { OmniError } from '../core/errors';
import {
  createInitialEntitlementState,
  type EntitlementState,
  type StoreProductPriceMap,
} from '../domain/entities/billing';
import type { FileInspectionResult } from '../domain/entities/format';
import {
  DEFAULT_CONVERSION_OPTIONS,
  type ConversionHistoryRecord,
  type ConversionJob,
  type ConversionOptions,
} from '../domain/entities/job';
import type { ConversionPreset } from '../domain/entities/preset';
import type { GuidedToolId } from '../domain/tools/toolCatalog';
import { conversionGraph } from '../domain/graph/conversionGraph';
import { inspectFile } from '../domain/inspector/magicByteInspector';
import { networkGuard } from '../infrastructure/cloud/networkGuard';
import { bundleFilesAsZip } from '../infrastructure/local/localArchiveConverter';
import { mergeMixedToPdfLocally } from '../infrastructure/local/localPdfConverter';
import { getPdfPageCount } from '../infrastructure/local/pdfPreviewEngine';
import {
  isNativeIos,
  OmniBilling,
  OmniNativeEngine,
  shareOrDownloadOutput,
  triggerHapticImpact,
  triggerHapticNotification,
} from '../infrastructure/native/omniNativeBridge';
import {
  localDb,
  type PersistedSettings,
  type ThemeMode,
} from '../infrastructure/storage/localDb';
import {
  fetchStoreKitPrices,
  getBatchLimit,
  getPresetLimit,
  isProFeatureJob,
  purchaseIapProduct,
  refundProAccess,
  reserveProAccess,
  restoreStorePurchases,
  shouldTriggerNaturalReviewPrompt,
  type ProTrialReservation,
} from './billingService';
import { buildOutputFileName, runConversionJob } from './conversionOrchestrator';

export type ActiveTab = 'convert' | 'queue' | 'history' | 'settings';

export interface ActiveWorkspaceState {
  toolId: GuidedToolId;
  target?: string;
  options?: Partial<ConversionOptions>;
}

export interface SelectedInputItem {
  id: string;
  file: File;
  inspection: FileInspectionResult;
  pageCount?: number;
  thumbUrl?: string;
}

interface AppContextValue {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeWorkspace: ActiveWorkspaceState | null;
  openWorkspace: (workspace: ActiveWorkspaceState) => void;
  closeWorkspace: () => void;
  hasFullscreenOverlay: boolean;
  registerOverlay: () => () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  paywallOpen: boolean;
  setPaywallOpen: (open: boolean) => void;
  reviewPromptVisible: boolean;
  dismissReviewPrompt: (rateNow: boolean) => void;

  settings: PersistedSettings;
  dict: Dictionary;
  toggleOfflineOnlyMode: () => void;
  setDefaultStripExif: (val: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: LocaleCode) => void;

  selectedInputs: SelectedInputItem[];
  addFiles: (files: File[]) => Promise<SelectedInputItem[]>;
  removeSelectedInput: (id: string) => void;
  moveSelectedInput: (id: string, direction: 'up' | 'down') => void;
  clearSelectedInputs: () => void;

  pendingPresetLaunch: ConversionPreset | null;
  launchCustomPreset: (preset: ConversionPreset) => void;
  consumePendingPresetLaunch: () => void;

  jobs: ConversionJob[];
  activeJobsCount: number;
  enqueueAndRun: (params: {
    targetFormat: string;
    options: ConversionOptions;
    allowCloudOverride?: boolean;
  }) => Promise<boolean>;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  clearCompletedJobs: () => void;
  bundleCompletedAsZip: () => Promise<void>;

  history: ConversionHistoryRecord[];
  clearHistory: () => void;
  deleteHistoryItems: (ids: string[]) => void;
  customPresets: ConversionPreset[];
  saveCustomPreset: (name: string, targetFormat: string, options: ConversionOptions) => void;
  deleteCustomPreset: (id: string) => void;

  entitlements: EntitlementState;
  storePrices: StoreProductPriceMap;
  buyProduct: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  cacheBytes: number;
  clearTempCache: () => Promise<void>;
  resetAllLocalData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveEffectiveTheme(theme: ThemeMode): 'light' | 'dark' | 'amoled' {
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }
  return theme;
}

const MERGEABLE_PDF_IMAGE_FORMATS = new Set(['pdf', 'png', 'jpg', 'webp', 'bmp', 'heic', 'heif', 'tiff', 'svg']);
const PREVIEWABLE_IMG_FORMATS = new Set(['png', 'jpg', 'webp', 'bmp', 'gif', 'ico', 'svg']);

async function buildSelectedItem(file: File): Promise<SelectedInputItem> {
  const inspection = await inspectFile(file);
  let pageCount: number | undefined;
  let thumbUrl: string | undefined;

  if (inspection.detectedFormatId === 'pdf') {
    pageCount = await getPdfPageCount(file);
  } else if (
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    (file.type.startsWith('image/') || PREVIEWABLE_IMG_FORMATS.has(inspection.detectedFormatId))
  ) {
    thumbUrl = URL.createObjectURL(file);
  }

  return {
    id: makeId('in'),
    file,
    inspection,
    pageCount,
    thumbUrl,
  };
}

function revokeThumb(item: SelectedInputItem): void {
  if (item.thumbUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(item.thumbUrl);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('convert');
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspaceState | null>(null);
  const openWorkspace = useCallback((workspace: ActiveWorkspaceState) => {
    setActiveWorkspace(workspace);
  }, []);
  const closeWorkspace = useCallback(() => {
    setActiveWorkspace(null);
  }, []);
  const [overlayCount, setOverlayCount] = useState(0);
  const registerOverlay = useCallback(() => {
    setOverlayCount((c) => c + 1);
    return () => setOverlayCount((c) => Math.max(0, c - 1));
  }, []);
  const [settings, setSettings] = useState<PersistedSettings>(() =>
    localDb.loadSettings(detectDefaultLocale()),
  );
  const [selectedInputs, setSelectedInputs] = useState<SelectedInputItem[]>([]);
  const [pendingPresetLaunch, setPendingPresetLaunch] = useState<ConversionPreset | null>(null);
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [history, setHistory] = useState<ConversionHistoryRecord[]>(() => localDb.loadHistory());
  const [customPresets, setCustomPresets] = useState<ConversionPreset[]>(() =>
    localDb.loadCustomPresets(),
  );
  const [entitlements, setEntitlements] = useState<EntitlementState>(() =>
    localDb.loadEntitlements(),
  );
  const [storePrices, setStorePrices] = useState<StoreProductPriceMap>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [reviewPromptVisible, setReviewPromptVisible] = useState(false);
  const [cacheBytes, setCacheBytes] = useState<number>(() => localDb.estimateStorageBytes());

  const abortMapRef = useRef<Map<string, AbortController>>(new Map());
  const toastTimerRef = useRef<number | null>(null);
  const entitlementsRef = useRef(entitlements);
  entitlementsRef.current = entitlements;

  const dict = DICTIONARIES[settings.locale] ?? DICTIONARIES.tr;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3400);
  }, []);

  useEffect(() => {
    void fetchStoreKitPrices().then(setStorePrices);
  }, []);

  useEffect(() => {
    networkGuard.setOfflineLocked(settings.offlineOnlyMode);
    localDb.saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const effective = resolveEffectiveTheme(settings.theme);
    document.documentElement.setAttribute('data-theme', effective);
    const bgHex = effective === 'light' ? '#F2F2F7' : effective === 'amoled' ? '#000000' : '#09090B';
    document.documentElement.style.backgroundColor = bgHex;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', bgHex);
    }
    if (isNativeIos()) {
      void OmniNativeEngine.setNativeAppearance({ theme: settings.theme }).catch(() => {});
      void StatusBar.setStyle({
        style: effective === 'light' ? Style.Light : Style.Dark,
      }).catch(() => {});
    }
  }, [settings.theme]);

  useEffect(() => {
    if (!isNativeIos()) return;
    void OmniNativeEngine.cleanupTempWorkspace().catch(() => {});
    const listenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void OmniNativeEngine.getSharedInboxFiles()
          .then(async ({ files }) => {
            if (!files || files.length === 0) return;
            const convertedFiles: File[] = files.map((f) => {
              const bin = atob(f.base64Data);
              const arr = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
              return new File([arr], f.name, { type: f.mime });
            });
            const inspected = await Promise.all(convertedFiles.map(buildSelectedItem));
            setSelectedInputs((prev) => [...prev, ...inspected]);
            setActiveTab('convert');
          })
          .catch(() => {});
      }
    });
    return () => {
      void listenerPromise.then((l) => l.remove());
    };
  }, []);

  const toggleOfflineOnlyMode = useCallback(() => {
    void triggerHapticImpact('medium');
    setSettings((prev) => ({ ...prev, offlineOnlyMode: !prev.offlineOnlyMode }));
  }, []);

  const setDefaultStripExif = useCallback((val: boolean) => {
    setSettings((prev) => ({ ...prev, defaultStripExif: val }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const setLocale = useCallback((locale: LocaleCode) => {
    setSettings((prev) => ({ ...prev, locale }));
  }, []);

  const addFiles = useCallback(async (files: File[]): Promise<SelectedInputItem[]> => {
    if (files.length === 0) return [];
    const inspected = await Promise.all(files.map(buildSelectedItem));
    setSelectedInputs((prev) => [...prev, ...inspected]);
    void triggerHapticImpact('light');
    return inspected;
  }, []);

  const removeSelectedInput = useCallback((id: string) => {
    setSelectedInputs((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) revokeThumb(target);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const moveSelectedInput = useCallback((id: string, direction: 'up' | 'down') => {
    setSelectedInputs((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(swapIdx, 0, moved);
      return next;
    });
    void triggerHapticImpact('light');
  }, []);

  const clearSelectedInputs = useCallback(() => {
    setSelectedInputs((prev) => {
      prev.forEach(revokeThumb);
      return [];
    });
  }, []);

  const launchCustomPreset = useCallback((preset: ConversionPreset) => {
    setPendingPresetLaunch(preset);
    setActiveTab('convert');
    setActiveWorkspace({
      toolId: 'universal',
      target: preset.targetFormat,
      options: preset.options,
    });
  }, []);

  const consumePendingPresetLaunch = useCallback(() => {
    setPendingPresetLaunch(null);
  }, []);

  const appendHistory = useCallback((record: ConversionHistoryRecord) => {
    setHistory((prev) => {
      const next = [record, ...prev].slice(0, 250);
      localDb.saveHistory(next);
      setCacheBytes(localDb.estimateStorageBytes());
      return next;
    });
  }, []);

  const executeJobInternal = useCallback(
    async (job: ConversionJob, batchSize: number) => {
      const controller = new AbortController();
      abortMapRef.current.set(job.id, controller);

      const usesPro = isProFeatureJob(job.plan, job.options, batchSize);
      let reservation: ProTrialReservation = { usedType: 'free_standard' };
      try {
        const res = reserveProAccess(entitlementsRef.current, usesPro);
        reservation = res.reservation;
        if (res.nextState !== entitlementsRef.current) {
          setEntitlements(res.nextState);
          localDb.saveEntitlements(res.nextState);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Pro required';
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: 'failed', errorCode: 'PRO_REQUIRED', errorMessage: message }
              : j,
          ),
        );
        setPaywallOpen(true);
        abortMapRef.current.delete(job.id);
        return;
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'running', progress: 5 } : j)),
      );

      try {
        const res = await runConversionJob(job, controller.signal, {
          onProgress: (progress, stageLabel, etaSeconds) => {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id ? { ...j, progress, stageLabel, etaSeconds } : j,
              ),
            );
          },
        });

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: 'completed',
                  progress: 100,
                  completedAt: Date.now(),
                  output: res.output,
                  cloudWiped: res.cloudWiped,
                }
              : j,
          ),
        );

        appendHistory({
          id: job.id,
          timestamp: Date.now(),
          sourceFileName: job.file.name,
          sourceFormat: job.inspection.detectedFormatId,
          targetFormat: job.targetFormat,
          sourceBytes: job.file.size,
          outputBytes: res.output.sizeBytes,
          tier: job.plan.highestTier,
          stepsChain: [job.plan.sourceFormat, ...job.plan.steps.map((s) => s.target)],
          status: 'completed',
          durationMs: res.durationMs,
          strippedExif: job.options.stripExif,
        });

        setEntitlements((prev) => {
          const next: EntitlementState = {
            ...prev,
            completedLocalConversions: prev.completedLocalConversions + 1,
          };
          localDb.saveEntitlements(next);
          if (shouldTriggerNaturalReviewPrompt(next)) {
            setReviewPromptVisible(true);
          }
          return next;
        });
        void triggerHapticNotification('success');
      } catch (err) {
        const isCancel = err instanceof OmniError && err.code === 'JOB_CANCELLED';
        let refunded = false;

        if (reservation.usedType === 'daily_trial') {
          setEntitlements((prev) => {
            const restored = refundProAccess(prev, reservation);
            localDb.saveEntitlements(restored);
            return restored;
          });
          refunded = true;
        }

        const errCode = err instanceof OmniError ? err.code : 'CONVERSION_ERROR';
        const errMsg = err instanceof Error ? err.message : 'Unexpected conversion error';

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: isCancel ? 'cancelled' : 'failed',
                  errorCode: errCode,
                  errorMessage: errMsg,
                  trialRefunded: refunded,
                }
              : j,
          ),
        );

        appendHistory({
          id: job.id,
          timestamp: Date.now(),
          sourceFileName: job.file.name,
          sourceFormat: job.inspection.detectedFormatId,
          targetFormat: job.targetFormat,
          sourceBytes: job.file.size,
          outputBytes: 0,
          tier: job.plan.highestTier,
          stepsChain: [job.plan.sourceFormat, ...job.plan.steps.map((s) => s.target)],
          status: isCancel ? 'cancelled' : 'failed',
          durationMs: 0,
          strippedExif: job.options.stripExif,
        });

        void triggerHapticNotification(isCancel ? 'warning' : 'error');
      } finally {
        abortMapRef.current.delete(job.id);
      }
    },
    [appendHistory],
  );

  const enqueueAndRun = useCallback(
    async ({
      targetFormat,
      options,
      allowCloudOverride = false,
    }: {
      targetFormat: string;
      options: ConversionOptions;
      allowCloudOverride?: boolean;
    }): Promise<boolean> => {
      if (selectedInputs.length === 0) return false;

      const batchLimit = getBatchLimit(entitlementsRef.current);
      if (selectedInputs.length > batchLimit && !entitlementsRef.current.isPro) {
        showToast(dict.queue.batchLimitReached);
        setPaywallOpen(true);
        return false;
      }

      // Unified Merge Fast-Path: Merges 2+ PDFs, 2+ Images, OR Mixed PDFs + Images in exact order!
      const allMergeableToPdf = selectedInputs.every((i) =>
        MERGEABLE_PDF_IMAGE_FORMATS.has(i.inspection.detectedFormatId),
      );
      const hasAnyPdf = selectedInputs.some((i) => i.inspection.detectedFormatId === 'pdf');

      if (targetFormat === 'pdf' && options.mergeIntoSinglePdf && allMergeableToPdf && selectedInputs.length > 1) {
        // Pure Images -> PDF is 100% free; PDF Merge uses 1 daily free Pro trial (or unlimited for Pro)
        let resv: ProTrialReservation = { usedType: 'free_standard' };
        if (hasAnyPdf) {
          try {
            const r = reserveProAccess(entitlementsRef.current, true);
            resv = r.reservation;
            if (r.nextState !== entitlementsRef.current) {
              setEntitlements(r.nextState);
              localDb.saveEntitlements(r.nextState);
            }
          } catch {
            setPaywallOpen(true);
            return false;
          }
        }

        const snapshot = [...selectedInputs];
        const jobId = makeId('job');
        const first = snapshot[0];
        const totalBytes = snapshot.reduce((sum, item) => sum + item.file.size, 0);
        const plan = conversionGraph.planConversion(first.inspection.detectedFormatId, 'pdf', {
          offlineOnly: settings.offlineOnlyMode,
          inspection: first.inspection,
        }) ?? {
          sourceFormat: first.inspection.detectedFormatId,
          targetFormat: 'pdf',
          steps: [
            {
              source: first.inspection.detectedFormatId,
              target: 'pdf',
              tier: 2 as const,
              engineId: 'local_pdf',
              qualityLoss: 0,
              latencyMsEst: 300,
            },
          ],
          highestTier: 2 as const,
          totalWeight: 20,
          warnings: [],
          blockedByOfflineLock: false,
          requiresCloud: false,
          estimatedMs: 300,
          estimatedCreditCost: 0,
        };

        const mergedJob: ConversionJob = {
          id: jobId,
          createdAt: Date.now(),
          file: new File([first.file], `${snapshot.length}_dosya`, { type: first.file.type }),
          inspection: first.inspection,
          targetFormat: 'pdf',
          plan,
          options,
          allowCloudOverride: false,
          status: 'running',
          progress: 25,
          stageLabel: `${snapshot.length} → PDF`,
        };
        // Preserve combined original size for accurate before/after display
        Object.defineProperty(mergedJob.file, 'size', { value: totalBytes });

        setJobs((prev) => [mergedJob, ...prev]);
        snapshot.forEach(revokeThumb);
        setSelectedInputs([]);
        setActiveTab('queue');

        try {
          const start = performance.now();
          const res = await mergeMixedToPdfLocally(
            snapshot.map((item) => ({
              blob: item.file,
              formatId: item.inspection.detectedFormatId,
            })),
            options,
          );
          const fileName = buildOutputFileName(`birlesik_${snapshot.length}_dosya`, 'pdf');
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'completed',
                    progress: 100,
                    completedAt: Date.now(),
                    output: {
                      fileName,
                      mime: res.mime,
                      formatId: 'pdf',
                      sizeBytes: res.blob.size,
                      blob: res.blob,
                    },
                  }
                : j,
            ),
          );
          appendHistory({
            id: jobId,
            timestamp: Date.now(),
            sourceFileName: `${snapshot.length} dosya (${hasAnyPdf ? 'PDF' : 'Görsel'})`,
            sourceFormat: hasAnyPdf ? 'pdf' : first.inspection.detectedFormatId,
            targetFormat: 'pdf',
            sourceBytes: totalBytes,
            outputBytes: res.blob.size,
            tier: 2,
            stepsChain: [hasAnyPdf ? 'pdf' : first.inspection.detectedFormatId, 'pdf'],
            status: 'completed',
            durationMs: Math.round(performance.now() - start),
            strippedExif: options.stripExif,
          });
          setEntitlements((prev) => {
            const next: EntitlementState = {
              ...prev,
              completedLocalConversions: prev.completedLocalConversions + 1,
            };
            localDb.saveEntitlements(next);
            if (shouldTriggerNaturalReviewPrompt(next)) {
              setReviewPromptVisible(true);
            }
            return next;
          });
          void triggerHapticNotification('success');
          return true;
        } catch (err) {
          if (resv.usedType === 'daily_trial') {
            setEntitlements((prev) => {
              const restored = refundProAccess(prev, resv);
              localDb.saveEntitlements(restored);
              return restored;
            });
          }
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'failed',
                    errorMessage: err instanceof Error ? err.message : 'PDF birleştirme başarısız oldu',
                    trialRefunded: resv.usedType === 'daily_trial',
                  }
                : j,
            ),
          );
          void triggerHapticNotification('error');
          return true;
        }
      }

      const snapshot = [...selectedInputs];
      const newJobs: ConversionJob[] = [];
      for (const item of snapshot) {
        const plan = conversionGraph.planConversion(
          item.inspection.detectedFormatId,
          targetFormat,
          {
            offlineOnly: settings.offlineOnlyMode && !allowCloudOverride,
            inspection: item.inspection,
            hasPassword: Boolean(options.password?.trim()),
          },
        );
        if (!plan) continue;
        newJobs.push({
          id: makeId('job'),
          createdAt: Date.now(),
          file: item.file,
          inspection: item.inspection,
          targetFormat,
          plan,
          options: { ...DEFAULT_CONVERSION_OPTIONS, ...options },
          allowCloudOverride,
          status: 'queued',
          progress: 0,
          stageLabel: `${plan.sourceFormat.toUpperCase()} → ${targetFormat.toUpperCase()}`,
        });
      }

      if (newJobs.length === 0) {
        showToast(dict.targetPicker.noResults);
        return false;
      }

      const batchSize = newJobs.length;
      setJobs((prev) => [...newJobs, ...prev]);
      snapshot.forEach(revokeThumb);
      setSelectedInputs([]);
      setActiveTab('queue');

      const concurrency = 3;
      for (let i = 0; i < newJobs.length; i += concurrency) {
        const batch = newJobs.slice(i, i + concurrency);
        await Promise.all(batch.map((job) => executeJobInternal(job, batchSize)));
      }
      return true;
    },
    [
      appendHistory,
      dict.queue.batchLimitReached,
      dict.targetPicker.noResults,
      executeJobInternal,
      selectedInputs,
      settings.offlineOnlyMode,
      showToast,
    ],
  );

  const cancelJob = useCallback((jobId: string) => {
    const ctrl = abortMapRef.current.get(jobId);
    if (ctrl) ctrl.abort();
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId && (j.status === 'queued' || j.status === 'running')
          ? { ...j, status: 'cancelled' }
          : j,
      ),
    );
  }, []);

  const retryJob = useCallback(
    (jobId: string) => {
      const target = jobs.find((j) => j.id === jobId);
      if (!target) return;
      const resetJob: ConversionJob = {
        ...target,
        status: 'queued',
        progress: 0,
        errorMessage: undefined,
        errorCode: undefined,
        trialRefunded: false,
      };
      setJobs((prev) => prev.map((j) => (j.id === jobId ? resetJob : j)));
      void executeJobInternal(resetJob, 1);
    },
    [executeJobInternal, jobs],
  );

  const clearCompletedJobs = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === 'running' || j.status === 'queued'));
  }, []);

  const bundleCompletedAsZip = useCallback(async () => {
    const done = jobs.filter((j) => j.status === 'completed' && j.output?.blob);
    if (done.length === 0) return;
    if (!entitlementsRef.current.isPro && done.length > 3) {
      setPaywallOpen(true);
      return;
    }
    const zipBlob = await bundleFilesAsZip(
      done.map((j) => ({ name: j.output!.fileName, blob: j.output!.blob! })),
    );
    await shareOrDownloadOutput(zipBlob, `OmniConvert_${Date.now()}.zip`);
    void triggerHapticNotification('success');
  }, [jobs]);

  const clearHistory = useCallback(() => {
    localDb.clearHistory();
    setHistory([]);
    setCacheBytes(localDb.estimateStorageBytes());
  }, []);

  const deleteHistoryItems = useCallback((ids: string[]) => {
    const removeSet = new Set(ids);
    setHistory((prev) => {
      const next = prev.filter((r) => !removeSet.has(r.id));
      localDb.saveHistory(next);
      setCacheBytes(localDb.estimateStorageBytes());
      return next;
    });
  }, []);

  const saveCustomPreset = useCallback(
    (name: string, targetFormat: string, options: ConversionOptions) => {
      if (customPresets.length >= getPresetLimit(entitlementsRef.current)) {
        showToast(dict.history.presetLimitReached);
        setPaywallOpen(true);
        return;
      }
      const preset: ConversionPreset = {
        id: makeId('preset'),
        customName: name.trim(),
        description: `${targetFormat.toUpperCase()} • ${options.quality}%${options.stripExif ? ' • EXIF' : ''}`,
        targetFormat,
        compatibleCategories: ['image', 'pdf', 'document', 'data', 'archive', 'audio', 'video'],
        options,
        isBuiltIn: false,
        createdAt: Date.now(),
      };
      setCustomPresets((prev) => {
        const next = [preset, ...prev];
        localDb.saveCustomPresets(next);
        return next;
      });
      showToast(dict.history.presetSaved);
    },
    [customPresets.length, dict.history.presetLimitReached, dict.history.presetSaved, showToast],
  );

  const deleteCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      localDb.saveCustomPresets(next);
      return next;
    });
  }, []);

  const buyProduct = useCallback(
    async (productId: string): Promise<boolean> => {
      try {
        const res = await purchaseIapProduct(entitlementsRef.current, productId);
        if (res.purchased) {
          setEntitlements(res.nextState);
          localDb.saveEntitlements(res.nextState);
          showToast(dict.paywall.purchaseSuccess);
          void triggerHapticNotification('success');
        }
        return res.purchased;
      } catch (err) {
        showToast(err instanceof Error ? err.message : dict.paywall.purchaseFailed);
        return false;
      }
    },
    [dict.paywall.purchaseFailed, dict.paywall.purchaseSuccess, showToast],
  );

  const restorePurchases = useCallback(async () => {
    const next = await restoreStorePurchases(entitlementsRef.current);
    setEntitlements(next);
    localDb.saveEntitlements(next);
    showToast(dict.settings.restoreSuccess);
  }, [dict.settings.restoreSuccess, showToast]);

  const clearTempCache = useCallback(async () => {
    if (isNativeIos()) {
      await OmniNativeEngine.cleanupTempWorkspace().catch(() => {});
    }
    setJobs((prev) => prev.filter((j) => j.status === 'running' || j.status === 'queued'));
    setCacheBytes(localDb.estimateStorageBytes());
    showToast(dict.settings.cacheCleared);
  }, [dict.settings.cacheCleared, showToast]);

  const resetAllLocalData = useCallback(async () => {
    if (isNativeIos()) {
      await OmniNativeEngine.cleanupTempWorkspace().catch(() => {});
    }
    localDb.wipeAllLocalData();
    setHistory([]);
    setCustomPresets([]);
    setJobs([]);
    clearSelectedInputs();
    setEntitlements(createInitialEntitlementState());
    setCacheBytes(0);
    showToast(dict.settings.cacheCleared);
  }, [clearSelectedInputs, dict.settings.cacheCleared, showToast]);

  const dismissReviewPrompt = useCallback((rateNow: boolean) => {
    setReviewPromptVisible(false);
    setEntitlements((prev) => {
      const next = { ...prev, reviewPromptDismissed: true };
      localDb.saveEntitlements(next);
      return next;
    });
    if (rateNow && isNativeIos()) {
      void OmniBilling.requestAppStoreReview().catch(() => {});
    }
  }, []);

  const activeJobsCount = useMemo(
    () => jobs.filter((j) => j.status === 'running' || j.status === 'queued').length,
    [jobs],
  );

  const value: AppContextValue = {
    activeTab,
    setActiveTab,
    activeWorkspace,
    openWorkspace,
    closeWorkspace,
    hasFullscreenOverlay: overlayCount > 0 || activeWorkspace !== null,
    registerOverlay,
    toastMessage,
    showToast,
    paywallOpen,
    setPaywallOpen,
    reviewPromptVisible,
    dismissReviewPrompt,
    settings,
    dict,
    toggleOfflineOnlyMode,
    setDefaultStripExif,
    setTheme,
    setLocale,
    selectedInputs,
    addFiles,
    removeSelectedInput,
    moveSelectedInput,
    clearSelectedInputs,
    pendingPresetLaunch,
    launchCustomPreset,
    consumePendingPresetLaunch,
    jobs,
    activeJobsCount,
    enqueueAndRun,
    cancelJob,
    retryJob,
    clearCompletedJobs,
    bundleCompletedAsZip,
    history,
    clearHistory,
    deleteHistoryItems,
    customPresets,
    saveCustomPreset,
    deleteCustomPreset,
    entitlements,
    storePrices,
    buyProduct,
    restorePurchases,
    cacheBytes,
    clearTempCache,
    resetAllLocalData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

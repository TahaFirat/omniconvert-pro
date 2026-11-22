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
import type { EntitlementState } from '../domain/entities/billing';
import { createInitialEntitlementState } from '../domain/entities/billing';
import type { FileInspectionResult } from '../domain/entities/format';
import {
  DEFAULT_CONVERSION_OPTIONS,
  type ConversionHistoryRecord,
  type ConversionJob,
  type ConversionOptions,
} from '../domain/entities/job';
import type { ConversionPreset } from '../domain/entities/preset';
import { conversionGraph } from '../domain/graph/conversionGraph';
import { inspectFile } from '../domain/inspector/magicByteInspector';
import { networkGuard } from '../infrastructure/cloud/networkGuard';
import { bundleFilesAsZip } from '../infrastructure/local/localArchiveConverter';
import { imagesToPdfLocally } from '../infrastructure/local/localPdfConverter';
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
  purchaseIapProduct,
  refundCloudQuota,
  reserveCloudQuota,
  restoreStorePurchases,
  shouldTriggerNaturalReviewPrompt,
  type CloudQuotaReservation,
} from './billingService';
import { buildOutputFileName, runConversionJob } from './conversionOrchestrator';

export type ActiveTab = 'convert' | 'queue' | 'history' | 'settings';

export interface SelectedInputItem {
  id: string;
  file: File;
  inspection: FileInspectionResult;
}

interface AppContextValue {
  // Navigation & UI
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  paywallOpen: boolean;
  setPaywallOpen: (open: boolean) => void;
  reviewPromptVisible: boolean;
  dismissReviewPrompt: (rateNow: boolean) => void;

  // Settings & i18n
  settings: PersistedSettings;
  dict: Dictionary;
  toggleOfflineOnlyMode: () => void;
  setDefaultStripExif: (val: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: LocaleCode) => void;

  // Input selection
  selectedInputs: SelectedInputItem[];
  addFiles: (files: File[]) => Promise<void>;
  removeSelectedInput: (id: string) => void;
  clearSelectedInputs: () => void;

  // Batch Queue
  jobs: ConversionJob[];
  activeJobsCount: number;
  enqueueAndRun: (params: {
    targetFormat: string;
    options: ConversionOptions;
    allowCloudOverride?: boolean;
  }) => Promise<void>;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  clearCompletedJobs: () => void;
  bundleCompletedAsZip: () => Promise<void>;

  // History & Presets
  history: ConversionHistoryRecord[];
  clearHistory: () => void;
  customPresets: ConversionPreset[];
  saveCustomPreset: (name: string, targetFormat: string, options: ConversionOptions) => void;
  deleteCustomPreset: (id: string) => void;

  // Billing & Storage
  entitlements: EntitlementState;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('convert');
  const [settings, setSettings] = useState<PersistedSettings>(() =>
    localDb.loadSettings(detectDefaultLocale()),
  );
  const [selectedInputs, setSelectedInputs] = useState<SelectedInputItem[]>([]);
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [history, setHistory] = useState<ConversionHistoryRecord[]>(() => localDb.loadHistory());
  const [customPresets, setCustomPresets] = useState<ConversionPreset[]>(() =>
    localDb.loadCustomPresets(),
  );
  const [entitlements, setEntitlements] = useState<EntitlementState>(() =>
    localDb.loadEntitlements(),
  );
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

  // Sync physical NetworkGuard with offlineOnlyMode setting
  useEffect(() => {
    networkGuard.setOfflineLocked(settings.offlineOnlyMode);
    localDb.saveSettings(settings);
  }, [settings]);

  // Apply theme attribute & native iOS StatusBar style
  useEffect(() => {
    const effective = resolveEffectiveTheme(settings.theme);
    document.documentElement.setAttribute('data-theme', effective);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        effective === 'light' ? '#F2F2F7' : '#000000',
      );
    }
    if (isNativeIos()) {
      void StatusBar.setStyle({
        style: effective === 'light' ? Style.Light : Style.Dark,
      }).catch(() => {});
    }
  }, [settings.theme]);

  // Startup orphan temp cleanup & Share Extension inbox check on iOS
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
            const inspected = await Promise.all(
              convertedFiles.map(async (file) => ({
                id: makeId('in'),
                file,
                inspection: await inspectFile(file),
              })),
            );
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

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const inspected = await Promise.all(
      files.map(async (file) => ({
        id: makeId('in'),
        file,
        inspection: await inspectFile(file),
      })),
    );
    setSelectedInputs((prev) => [...prev, ...inspected]);
    void triggerHapticImpact('light');
  }, []);

  const removeSelectedInput = useCallback((id: string) => {
    setSelectedInputs((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearSelectedInputs = useCallback(() => {
    setSelectedInputs([]);
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
    async (job: ConversionJob) => {
      const controller = new AbortController();
      abortMapRef.current.set(job.id, controller);

      let cloudReservation: CloudQuotaReservation | null = null;
      if (job.plan.requiresCloud) {
        try {
          const reserved = reserveCloudQuota(entitlementsRef.current, job.file.size);
          cloudReservation = reserved.reservation;
          setEntitlements(reserved.nextState);
          localDb.saveEntitlements(reserved.nextState);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Quota exceeded';
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? { ...j, status: 'failed', errorCode: 'INSUFFICIENT_CREDITS', errorMessage: message }
                : j,
            ),
          );
          setPaywallOpen(true);
          abortMapRef.current.delete(job.id);
          return;
        }
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
          stepsChain: [
            job.plan.sourceFormat,
            ...job.plan.steps.map((s) => s.target),
          ],
          status: 'completed',
          durationMs: res.durationMs,
          strippedExif: job.options.stripExif,
        });

        // Track local conversion count for natural 3rd-conversion review prompt
        if (!job.plan.requiresCloud) {
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
        }
        void triggerHapticNotification('success');
      } catch (err) {
        const isCancel = err instanceof OmniError && err.code === 'JOB_CANCELLED';
        let refunded = false;

        // Credit Fairness Rule: automatic immediate refund on failure or cancel!
        if (cloudReservation) {
          setEntitlements((prev) => {
            const restored = refundCloudQuota(prev, cloudReservation!);
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
                  creditRefunded: refunded,
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
          stepsChain: [
            job.plan.sourceFormat,
            ...job.plan.steps.map((s) => s.target),
          ],
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
    }) => {
      if (selectedInputs.length === 0) return;

      // Special fast-path: Merge multiple selected images into ONE PDF locally (e.g. E-Devlet PDF preset!)
      const allImages = selectedInputs.every((i) =>
        ['png', 'jpg', 'webp', 'bmp'].includes(i.inspection.detectedFormatId),
      );
      if (targetFormat === 'pdf' && options.mergeIntoSinglePdf && allImages && selectedInputs.length > 1) {
        const jobId = makeId('job');
        const first = selectedInputs[0];
        const plan = conversionGraph.planConversion(first.inspection.detectedFormatId, 'pdf', {
          offlineOnly: settings.offlineOnlyMode,
          inspection: first.inspection,
        });
        if (plan) {
          const mergedJob: ConversionJob = {
            id: jobId,
            createdAt: Date.now(),
            file: first.file,
            inspection: first.inspection,
            targetFormat: 'pdf',
            plan,
            options,
            allowCloudOverride: false,
            status: 'running',
            progress: 15,
            stageLabel: `Merging ${selectedInputs.length} images → PDF`,
          };
          setJobs((prev) => [mergedJob, ...prev]);
          setSelectedInputs([]);
          setActiveTab('queue');

          try {
            const start = performance.now();
            const res = await imagesToPdfLocally(
              selectedInputs.map((item) => ({
                blob: item.file,
                formatId: item.inspection.detectedFormatId,
              })),
              options,
            );
            const fileName = buildOutputFileName(`merged_${selectedInputs.length}_pages`, 'pdf');
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
              sourceFileName: `${selectedInputs.length} images`,
              sourceFormat: first.inspection.detectedFormatId,
              targetFormat: 'pdf',
              sourceBytes: selectedInputs.reduce((s, x) => s + x.file.size, 0),
              outputBytes: res.blob.size,
              tier: 2,
              stepsChain: [first.inspection.detectedFormatId, 'pdf'],
              status: 'completed',
              durationMs: Math.round(performance.now() - start),
              strippedExif: options.stripExif,
            });
            void triggerHapticNotification('success');
          } catch (err) {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === jobId
                  ? {
                      ...j,
                      status: 'failed',
                      errorMessage: err instanceof Error ? err.message : 'PDF merge failed',
                    }
                  : j,
              ),
            );
          }
          return;
        }
      }

      const newJobs: ConversionJob[] = [];
      for (const item of selectedInputs) {
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

      if (newJobs.length === 0) return;

      setJobs((prev) => [...newJobs, ...prev]);
      setSelectedInputs([]);
      setActiveTab('queue');

      // Execute up to 3 jobs concurrently without blocking UI thread
      const concurrency = 3;
      for (let i = 0; i < newJobs.length; i += concurrency) {
        const batch = newJobs.slice(i, i + concurrency);
        await Promise.all(batch.map((job) => executeJobInternal(job)));
      }
    },
    [appendHistory, executeJobInternal, selectedInputs, settings.offlineOnlyMode],
  );

  const cancelJob = useCallback((jobId: string) => {
    const ctrl = abortMapRef.current.get(jobId);
    if (ctrl) ctrl.abort();
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId && (j.status === 'queued' || j.status === 'running') ? { ...j, status: 'cancelled' } : j)),
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
        creditRefunded: false,
      };
      setJobs((prev) => prev.map((j) => (j.id === jobId ? resetJob : j)));
      void executeJobInternal(resetJob);
    },
    [executeJobInternal, jobs],
  );

  const clearCompletedJobs = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === 'running' || j.status === 'queued'));
  }, []);

  const bundleCompletedAsZip = useCallback(async () => {
    const done = jobs.filter((j) => j.status === 'completed' && j.output?.blob);
    if (done.length === 0) return;
    const zipBlob = await bundleFilesAsZip(
      done.map((j) => ({ name: j.output!.fileName, blob: j.output!.blob! })),
    );
    await shareOrDownloadOutput(zipBlob, `OmniConvert_Batch_${Date.now()}.zip`);
    void triggerHapticNotification('success');
  }, [jobs]);

  const clearHistory = useCallback(() => {
    localDb.clearHistory();
    setHistory([]);
    setCacheBytes(localDb.estimateStorageBytes());
  }, []);

  const saveCustomPreset = useCallback(
    (name: string, targetFormat: string, options: ConversionOptions) => {
      const preset: ConversionPreset = {
        id: makeId('preset'),
        customName: name.trim(),
        description: `${targetFormat.toUpperCase()} • Q${options.quality}%${options.stripExif ? ' • EXIF Clean' : ''}`,
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
    [dict.history.presetSaved, showToast],
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
      const res = await purchaseIapProduct(entitlementsRef.current, productId);
      if (res.purchased) {
        setEntitlements(res.nextState);
        localDb.saveEntitlements(res.nextState);
        showToast(dict.paywall.purchaseSuccess);
        void triggerHapticNotification('success');
      }
      return res.purchased;
    },
    [dict.paywall.purchaseSuccess, showToast],
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
    setSelectedInputs([]);
    setEntitlements(createInitialEntitlementState());
    setCacheBytes(0);
    showToast(dict.settings.cacheCleared);
  }, [dict.settings.cacheCleared, showToast]);

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
    clearSelectedInputs,
    jobs,
    activeJobsCount,
    enqueueAndRun,
    cancelJob,
    retryJob,
    clearCompletedJobs,
    bundleCompletedAsZip,
    history,
    clearHistory,
    customPresets,
    saveCustomPreset,
    deleteCustomPreset,
    entitlements,
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

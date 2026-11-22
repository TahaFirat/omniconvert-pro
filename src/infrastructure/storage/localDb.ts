import type { LocaleCode } from '../../core/i18n';
import type { EntitlementState } from '../../domain/entities/billing';
import { createInitialEntitlementState } from '../../domain/entities/billing';
import type { ConversionHistoryRecord } from '../../domain/entities/job';
import type { ConversionPreset } from '../../domain/entities/preset';

export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';

export interface PersistedSettings {
  offlineOnlyMode: boolean;
  defaultStripExif: boolean;
  theme: ThemeMode;
  locale: LocaleCode;
}

const KEYS = {
  SETTINGS: 'omniconvert_settings_v1',
  HISTORY: 'omniconvert_history_v1',
  PRESETS: 'omniconvert_custom_presets_v1',
  ENTITLEMENTS: 'omniconvert_entitlements_v1',
} as const;

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or restricted private mode
  }
}

export const localDb = {
  loadSettings(defaultLocale: LocaleCode): PersistedSettings {
    return safeReadJson<PersistedSettings>(KEYS.SETTINGS, {
      offlineOnlyMode: false,
      defaultStripExif: true,
      theme: 'dark',
      locale: defaultLocale,
    });
  },

  saveSettings(settings: PersistedSettings): void {
    safeWriteJson(KEYS.SETTINGS, settings);
  },

  loadHistory(): ConversionHistoryRecord[] {
    return safeReadJson<ConversionHistoryRecord[]>(KEYS.HISTORY, []);
  },

  saveHistory(records: ConversionHistoryRecord[]): void {
    safeWriteJson(KEYS.HISTORY, records.slice(0, 250));
  },

  clearHistory(): void {
    safeWriteJson(KEYS.HISTORY, []);
  },

  loadCustomPresets(): ConversionPreset[] {
    return safeReadJson<ConversionPreset[]>(KEYS.PRESETS, []);
  },

  saveCustomPresets(presets: ConversionPreset[]): void {
    safeWriteJson(KEYS.PRESETS, presets);
  },

  loadEntitlements(): EntitlementState {
    return safeReadJson<EntitlementState>(KEYS.ENTITLEMENTS, createInitialEntitlementState());
  },

  saveEntitlements(entitlements: EntitlementState): void {
    safeWriteJson(KEYS.ENTITLEMENTS, entitlements);
  },

  estimateStorageBytes(): number {
    try {
      if (typeof localStorage === 'undefined') return 0;
      let total = 0;
      for (const k of Object.values(KEYS)) {
        const val = localStorage.getItem(k);
        if (val) total += val.length * 2;
      }
      return total;
    } catch {
      return 0;
    }
  },

  wipeAllLocalData(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      for (const k of Object.values(KEYS)) {
        localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  },
};

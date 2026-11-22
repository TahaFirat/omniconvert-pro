import { MONETIZATION_CONFIG } from '../core/constants';
import { InsufficientCreditsError } from '../core/errors';
import {
  getTodayIsoDate,
  PRO_PLAN_PRODUCTS,
  type EntitlementState,
  type StoreProductPriceMap,
} from '../domain/entities/billing';
import type { ConversionOptions, ConversionPlan } from '../domain/entities/job';
import { isNativeIos, OmniBilling } from '../infrastructure/native/omniNativeBridge';

export interface ProTrialReservation {
  usedType: 'free_standard' | 'pro' | 'daily_trial';
}

const PRO_RAW_SOURCES = new Set(['dng', 'cr2', 'nef', 'arw']);
const PRO_MEDIA_ENGINES = new Set(['ios_avfoundation', 'ios_vision_ocr', 'ios_pdfkit']);

/**
 * Determines whether a conversion uses an advanced Pro feature.
 * Everyday single conversions (Images, DOCX/XLSX/EPUB/MD/HTML/TXT, Data JSON/YAML/CSV/XML,
 * Archives ZIP/TAR/GZ, Images->PDF, EXIF strip) are ALWAYS 100% free & unlimited!
 */
export function isProFeatureJob(
  plan: ConversionPlan,
  options: ConversionOptions,
  batchSize: number,
): boolean {
  if (batchSize > MONETIZATION_CONFIG.FREE_BATCH_LIMIT) return true;
  if (PRO_RAW_SOURCES.has(plan.sourceFormat)) return true;
  if (plan.steps.some((s) => PRO_MEDIA_ENGINES.has(s.engineId))) return true;
  if (plan.sourceFormat === 'pdf' && plan.targetFormat === 'pdf') return true; // PDF Split / Rotate / Merge
  if (options.pdfPageRange?.trim()) return true;
  if (options.pdfRotateDegrees) return true;
  return false;
}

export function normalizeDailyTrials(state: EntitlementState): EntitlementState {
  const today = getTodayIsoDate();
  if (state.dailyProTrialsDate !== today) {
    return {
      ...state,
      dailyProTrialsUsed: 0,
      dailyProTrialsDate: today,
    };
  }
  return state;
}

export function getRemainingDailyProTrials(state: EntitlementState): number {
  if (state.isPro) return MONETIZATION_CONFIG.FREE_DAILY_PRO_TRIALS;
  const normalized = normalizeDailyTrials(state);
  return Math.max(0, MONETIZATION_CONFIG.FREE_DAILY_PRO_TRIALS - normalized.dailyProTrialsUsed);
}

export function getBatchLimit(state: EntitlementState): number {
  return state.isPro ? MONETIZATION_CONFIG.PRO_BATCH_LIMIT : MONETIZATION_CONFIG.FREE_BATCH_LIMIT;
}

export function getPresetLimit(state: EntitlementState): number {
  return state.isPro ? 999 : MONETIZATION_CONFIG.FREE_CUSTOM_PRESETS_LIMIT;
}

/**
 * Atomically checks/reserves a daily free Pro trial if the user is on Free tier and runs a Pro feature.
 * Standard conversions NEVER consume trials — they are free & unlimited forever!
 */
export function reserveProAccess(
  state: EntitlementState,
  usesProFeature: boolean,
): { nextState: EntitlementState; reservation: ProTrialReservation } {
  if (!usesProFeature) {
    return { nextState: state, reservation: { usedType: 'free_standard' } };
  }
  const normalized = normalizeDailyTrials(state);
  if (normalized.isPro) {
    return { nextState: normalized, reservation: { usedType: 'pro' } };
  }
  if (normalized.dailyProTrialsUsed < MONETIZATION_CONFIG.FREE_DAILY_PRO_TRIALS) {
    return {
      nextState: {
        ...normalized,
        dailyProTrialsUsed: normalized.dailyProTrialsUsed + 1,
      },
      reservation: { usedType: 'daily_trial' },
    };
  }
  throw new InsufficientCreditsError();
}

/**
 * Fairness Rule: automatically refunds the daily free Pro trial if a job fails or is cancelled.
 */
export function refundProAccess(
  state: EntitlementState,
  reservation: ProTrialReservation,
): EntitlementState {
  if (reservation.usedType === 'daily_trial') {
    return {
      ...state,
      dailyProTrialsUsed: Math.max(0, state.dailyProTrialsUsed - 1),
    };
  }
  return state;
}

/**
 * Loads live localized StoreKit 2 displayPrice values directly from Apple App Store (TRY/USD/EUR).
 */
export async function fetchStoreKitPrices(): Promise<StoreProductPriceMap> {
  const defaults: StoreProductPriceMap = {};
  for (const p of PRO_PLAN_PRODUCTS) {
    defaults[p.productId] = p.fallbackPriceDisplay;
  }
  if (!isNativeIos()) return defaults;
  try {
    const res = await OmniBilling.getProducts({
      productIds: PRO_PLAN_PRODUCTS.map((p) => p.productId),
    });
    for (const prod of res.products ?? []) {
      if (prod.id && prod.displayPrice) {
        defaults[prod.id] = prod.displayPrice;
      }
    }
  } catch {
    // Keep fallback prices if offline
  }
  return defaults;
}

export async function purchaseIapProduct(
  state: EntitlementState,
  productId: string,
): Promise<{ nextState: EntitlementState; purchased: boolean }> {
  if (isNativeIos()) {
    const res = await OmniBilling.purchaseProduct({ productId });
    if (!res.success) {
      return { nextState: state, purchased: false };
    }
  }

  if (productId === MONETIZATION_CONFIG.PRODUCTS.PRO_LIFETIME) {
    return {
      nextState: {
        ...state,
        isPro: true,
        isLifetime: true,
        proExpiresAt: undefined,
      },
      purchased: true,
    };
  }

  if (
    productId === MONETIZATION_CONFIG.PRODUCTS.PRO_MONTHLY ||
    productId === MONETIZATION_CONFIG.PRODUCTS.PRO_YEARLY
  ) {
    const durationMs =
      productId === MONETIZATION_CONFIG.PRODUCTS.PRO_YEARLY
        ? 365 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
    return {
      nextState: {
        ...state,
        isPro: true,
        proExpiresAt: Date.now() + durationMs,
      },
      purchased: true,
    };
  }

  return { nextState: state, purchased: false };
}

export async function restoreStorePurchases(
  state: EntitlementState,
): Promise<EntitlementState> {
  if (isNativeIos()) {
    const res = await OmniBilling.restorePurchases();
    const hasLifetime = res.restoredProductIds.includes(MONETIZATION_CONFIG.PRODUCTS.PRO_LIFETIME);
    return {
      ...state,
      isPro: res.isPro || hasLifetime || state.isPro,
      isLifetime: hasLifetime || state.isLifetime,
      lastRestoredAt: Date.now(),
    };
  }
  return {
    ...state,
    lastRestoredAt: Date.now(),
  };
}

export function shouldTriggerNaturalReviewPrompt(state: EntitlementState): boolean {
  return (
    !state.reviewPromptDismissed &&
    state.completedLocalConversions >= MONETIZATION_CONFIG.REVIEW_PROMPT_AFTER_LOCAL_SUCCESSES
  );
}

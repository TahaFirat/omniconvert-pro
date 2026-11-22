import { MONETIZATION_CONFIG } from '../core/constants';
import { InsufficientCreditsError } from '../core/errors';
import {
  CREDIT_PACKS,
  getTodayIsoDate,
  type EntitlementState,
} from '../domain/entities/billing';
import { isNativeIos, OmniBilling } from '../infrastructure/native/omniNativeBridge';

export interface CloudQuotaReservation {
  usedType: 'pro' | 'daily_trial' | 'credit';
  creditsCharged: number;
}

export function normalizeDailyTrials(state: EntitlementState): EntitlementState {
  const today = getTodayIsoDate();
  if (state.dailyFreeCloudTrialsDate !== today) {
    return {
      ...state,
      dailyFreeCloudTrialsUsed: 0,
      dailyFreeCloudTrialsDate: today,
    };
  }
  return state;
}

export function getRemainingDailyFreeTrials(state: EntitlementState): number {
  const normalized = normalizeDailyTrials(state);
  return Math.max(0, MONETIZATION_CONFIG.FREE_DAILY_CLOUD_TRIALS - normalized.dailyFreeCloudTrialsUsed);
}

export function getBatchLimit(state: EntitlementState): number {
  if (state.isPro) return MONETIZATION_CONFIG.PRO_BATCH_LIMIT;
  if (state.cloudCreditsBalance > 0) return MONETIZATION_CONFIG.CREDIT_PACK_BATCH_LIMIT;
  return MONETIZATION_CONFIG.FREE_BATCH_LIMIT;
}

/**
 * Atomically reserves quota before launching a Tier 3 Cloud job.
 * Tier 1 & Tier 2 local jobs NEVER call this — they are 100% free forever!
 */
export function reserveCloudQuota(
  state: EntitlementState,
  fileSizeBytes: number,
): { nextState: EntitlementState; reservation: CloudQuotaReservation } {
  const normalized = normalizeDailyTrials(state);

  if (normalized.isPro) {
    return {
      nextState: normalized,
      reservation: { usedType: 'pro', creditsCharged: 0 },
    };
  }

  // Daily 3 free cloud trials (<= 25 MB)
  if (
    normalized.dailyFreeCloudTrialsUsed < MONETIZATION_CONFIG.FREE_DAILY_CLOUD_TRIALS &&
    fileSizeBytes <= MONETIZATION_CONFIG.FREE_CLOUD_MAX_BYTES
  ) {
    return {
      nextState: {
        ...normalized,
        dailyFreeCloudTrialsUsed: normalized.dailyFreeCloudTrialsUsed + 1,
      },
      reservation: { usedType: 'daily_trial', creditsCharged: 0 },
    };
  }

  // Never-expiring credit pack balance
  if (normalized.cloudCreditsBalance >= 1) {
    return {
      nextState: {
        ...normalized,
        cloudCreditsBalance: normalized.cloudCreditsBalance - 1,
      },
      reservation: { usedType: 'credit', creditsCharged: 1 },
    };
  }

  throw new InsufficientCreditsError();
}

/**
 * Credit Fairness Rule: automatically and immediately refunds spent cloud credit/trial on failure.
 */
export function refundCloudQuota(
  state: EntitlementState,
  reservation: CloudQuotaReservation,
): EntitlementState {
  if (reservation.usedType === 'credit') {
    return {
      ...state,
      cloudCreditsBalance: state.cloudCreditsBalance + reservation.creditsCharged,
    };
  }
  if (reservation.usedType === 'daily_trial') {
    return {
      ...state,
      dailyFreeCloudTrialsUsed: Math.max(0, state.dailyFreeCloudTrialsUsed - 1),
    };
  }
  return state;
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

  // Apply entitlement based on StoreKit 2 verified product ID
  const pack = CREDIT_PACKS.find((p) => p.productId === productId);
  if (pack) {
    return {
      nextState: {
        ...state,
        cloudCreditsBalance: state.cloudCreditsBalance + pack.credits,
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
    return {
      ...state,
      isPro: res.isPro || state.isPro,
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

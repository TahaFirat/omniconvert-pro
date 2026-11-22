import { MONETIZATION_CONFIG } from '../../core/constants';

export interface ProPlanProduct {
  productId: string;
  kind: 'monthly' | 'yearly' | 'lifetime';
  fallbackPriceDisplay: string;
  badgeText?: string;
}

export interface StoreProductPriceMap {
  [productId: string]: string;
}

export interface EntitlementState {
  isPro: boolean;
  isLifetime: boolean;
  proExpiresAt?: number;
  dailyProTrialsUsed: number;
  dailyProTrialsDate: string; // YYYY-MM-DD
  completedLocalConversions: number;
  reviewPromptDismissed: boolean;
  lastRestoredAt?: number;
}

export const PRO_PLAN_PRODUCTS: readonly ProPlanProduct[] = [
  {
    productId: MONETIZATION_CONFIG.PRODUCTS.PRO_YEARLY,
    kind: 'yearly',
    fallbackPriceDisplay: '$9.99',
    badgeText: '%58',
  },
  {
    productId: MONETIZATION_CONFIG.PRODUCTS.PRO_LIFETIME,
    kind: 'lifetime',
    fallbackPriceDisplay: '$14.99',
  },
  {
    productId: MONETIZATION_CONFIG.PRODUCTS.PRO_MONTHLY,
    kind: 'monthly',
    fallbackPriceDisplay: '$1.99',
  },
];

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createInitialEntitlementState(): EntitlementState {
  return {
    isPro: false,
    isLifetime: false,
    dailyProTrialsUsed: 0,
    dailyProTrialsDate: getTodayIsoDate(),
    completedLocalConversions: 0,
    reviewPromptDismissed: false,
  };
}

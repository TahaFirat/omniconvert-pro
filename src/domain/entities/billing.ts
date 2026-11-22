import { MONETIZATION_CONFIG } from '../../core/constants';

export interface CreditPackProduct {
  productId: string;
  credits: number;
  priceDisplay: string;
  neverExpires: true;
}

export interface SubscriptionProduct {
  productId: string;
  period: 'monthly' | 'yearly';
  priceDisplay: string;
  discountBadge?: string;
}

export interface EntitlementState {
  isPro: boolean;
  proExpiresAt?: number;
  cloudCreditsBalance: number;
  dailyFreeCloudTrialsUsed: number;
  dailyFreeCloudTrialsDate: string; // YYYY-MM-DD
  completedLocalConversions: number;
  reviewPromptDismissed: boolean;
  lastRestoredAt?: number;
}

export const CREDIT_PACKS: readonly CreditPackProduct[] = [
  {
    productId: MONETIZATION_CONFIG.PRODUCTS.CREDITS_100,
    credits: 100,
    priceDisplay: '$2.99',
    neverExpires: true,
  },
  {
    productId: MONETIZATION_CONFIG.PRODUCTS.CREDITS_500,
    credits: 500,
    priceDisplay: '$9.99',
    neverExpires: true,
  },
  {
    productId: MONETIZATION_CONFIG.PRODUCTS.CREDITS_2000,
    credits: 2000,
    priceDisplay: '$29.99',
    neverExpires: true,
  },
];

export const SUBSCRIPTION_PRODUCTS: readonly SubscriptionProduct[] = [
  {
    productId: MONETIZATION_CONFIG.PRODUCTS.PRO_MONTHLY,
    period: 'monthly',
    priceDisplay: '$4.99 / ay',
  },
  {
    productId: MONETIZATION_CONFIG.PRODUCTS.PRO_YEARLY,
    period: 'yearly',
    priceDisplay: '$29.99 / yıl',
    discountBadge: '%50',
  },
];

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createInitialEntitlementState(): EntitlementState {
  return {
    isPro: false,
    cloudCreditsBalance: 0,
    dailyFreeCloudTrialsUsed: 0,
    dailyFreeCloudTrialsDate: getTodayIsoDate(),
    completedLocalConversions: 0,
    reviewPromptDismissed: false,
  };
}

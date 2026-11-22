import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { APP_CONFIG } from '../../core/constants';
import { CREDIT_PACKS, SUBSCRIPTION_PRODUCTS } from '../../domain/entities/billing';

export const PaywallModal: React.FC = () => {
  const {
    dict,
    paywallOpen,
    setPaywallOpen,
    buyProduct,
    restorePurchases,
    entitlements,
  } = useApp();

  const [busyId, setBusyId] = useState<string | null>(null);

  if (!paywallOpen) return null;

  const handleBuy = async (productId: string) => {
    setBusyId(productId);
    try {
      const ok = await buyProduct(productId);
      if (ok) setPaywallOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dict.paywall.title}>
      <div className="modal-sheet">
        <div className="sheet-grabber" />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {dict.paywall.title}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {dict.paywall.subtitle}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: 34, height: 34, minHeight: 34, padding: 0, borderRadius: '50%' }}
            aria-label={dict.paywall.close}
            onClick={() => setPaywallOpen(false)}
          >
            <X size={17} />
          </button>
        </div>

        {/* Pro Subscription */}
        <div>
          <div className="section-header" style={{ paddingLeft: 2 }}>
            {dict.paywall.proTitle}
          </div>
          <p style={{ margin: '0 0 10px 2px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {dict.paywall.proFeatures}
          </p>
          <div className="grid-2">
            {SUBSCRIPTION_PRODUCTS.map((sub) => (
              <button
                key={sub.productId}
                type="button"
                className={sub.period === 'yearly' ? 'btn btn-primary' : 'btn btn-secondary'}
                disabled={busyId !== null}
                onClick={() => void handleBuy(sub.productId)}
                style={{
                  flexDirection: 'column',
                  gap: 3,
                  padding: '13px 12px',
                  background: sub.period === 'yearly' ? 'var(--accent)' : 'var(--sheet-card)',
                }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9 }}>
                  {sub.period === 'yearly' ? dict.paywall.proYearly : dict.paywall.proMonthly}
                  {sub.discountBadge ? ` (${sub.discountBadge})` : ''}
                </span>
                <span style={{ fontSize: '0.94rem', fontWeight: 700 }}>{sub.priceDisplay}</span>
              </button>
            ))}
          </div>
          {entitlements.isPro && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--green-text)', marginTop: 8 }}>
              <Check size={14} />
              <span>{dict.settings.proStatusActive}</span>
            </div>
          )}
        </div>

        {/* Credit Packs */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 8px 2px' }}>
            <span className="section-header" style={{ padding: 0, margin: 0 }}>
              {dict.paywall.creditPacksTitle}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {dict.paywall.neverExpiresBadge}
            </span>
          </div>

          <div className="ios-group" style={{ background: 'var(--sheet-card)' }}>
            {CREDIT_PACKS.map((pack) => {
              const label =
                pack.credits === 100
                  ? dict.paywall.pack100
                  : pack.credits === 500
                    ? dict.paywall.pack500
                    : dict.paywall.pack2000;
              return (
                <button
                  key={pack.productId}
                  type="button"
                  disabled={busyId !== null}
                  className="ios-row ios-row-interactive"
                  onClick={() => void handleBuy(pack.productId)}
                >
                  <span style={{ fontWeight: 500, fontSize: '0.92rem' }}>{label}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.92rem' }}>
                    {busyId === pack.productId ? '...' : pack.priceDisplay}
                  </span>
                </button>
              );
            })}
          </div>
          <p style={{ margin: '8px 2px 0 2px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {dict.paywall.refundRule}
          </p>
        </div>

        {/* Restore Purchases (Guideline 3.1.1) */}
        <button
          type="button"
          className="btn btn-ghost"
          data-testid="paywall-restore-btn"
          onClick={() => void restorePurchases()}
          style={{ width: '100%', minHeight: 40 }}
        >
          {dict.paywall.restorePurchases}
        </button>

        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.45, textAlign: 'center' }}>
          {dict.paywall.autoRenewalDisclosure}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: '0.74rem' }}>
          <a
            href={APP_CONFIG.privacyPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            {dict.settings.privacyPolicy}
          </a>
          <a
            href={APP_CONFIG.termsOfUseUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            {dict.settings.termsOfUse}
          </a>
        </div>
      </div>
    </div>
  );
};

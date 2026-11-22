import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useApp } from '../../application/AppContext';
import { APP_CONFIG, MONETIZATION_CONFIG } from '../../core/constants';
import { PRO_PLAN_PRODUCTS } from '../../domain/entities/billing';

export const PaywallModal: React.FC = () => {
  const {
    dict,
    paywallOpen,
    setPaywallOpen,
    buyProduct,
    restorePurchases,
    storePrices,
  } = useApp();

  const [selectedId, setSelectedId] = useState<string>(MONETIZATION_CONFIG.PRODUCTS.PRO_YEARLY);
  const [busy, setBusy] = useState(false);

  if (!paywallOpen) return null;

  const features = [
    dict.paywall.featureBatch,
    dict.paywall.featurePdf,
    dict.paywall.featureMedia,
    dict.paywall.featureOcrRaw,
  ];

  const handleContinue = async () => {
    setBusy(true);
    try {
      const ok = await buyProduct(selectedId);
      if (ok) setPaywallOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dict.paywall.title}>
      <div className="modal-sheet">
        <div className="sheet-grabber" />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
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

        {/* Clean 4-Point Pro Benefits (100% Real On-Device) */}
        <div className="ios-group" style={{ background: 'var(--sheet-card)' }}>
          {features.map((feat) => (
            <div key={feat} className="ios-row" style={{ minHeight: 44, padding: '10px 14px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 10, fontSize: '0.86rem', lineHeight: 1.35 }}>
                <Check size={16} color="var(--accent)" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{feat}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Fair 3-Plan Selector with Live StoreKit 2 Prices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRO_PLAN_PRODUCTS.map((plan) => {
            const active = selectedId === plan.productId;
            const title =
              plan.kind === 'yearly'
                ? dict.paywall.yearlyTitle
                : plan.kind === 'lifetime'
                  ? dict.paywall.lifetimeTitle
                  : dict.paywall.monthlyTitle;
            const sub =
              plan.kind === 'yearly'
                ? dict.paywall.yearlySub
                : plan.kind === 'lifetime'
                  ? dict.paywall.lifetimeSub
                  : dict.paywall.monthlySub;
            const livePrice = storePrices[plan.productId] || plan.fallbackPriceDisplay;

            return (
              <button
                key={plan.productId}
                type="button"
                data-testid={`plan-${plan.kind}`}
                onClick={() => setSelectedId(plan.productId)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '13px 15px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--separator)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--sheet-card)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {sub}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.98rem', color: active ? 'var(--accent)' : 'var(--text-primary)', flexShrink: 0 }}>
                  {livePrice}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          data-testid="paywall-continue-btn"
          onClick={() => void handleContinue()}
          style={{ width: '100%' }}
        >
          {busy ? '...' : dict.paywall.continueCta}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          data-testid="paywall-restore-btn"
          onClick={() => void restorePurchases()}
          style={{ width: '100%', minHeight: 38 }}
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

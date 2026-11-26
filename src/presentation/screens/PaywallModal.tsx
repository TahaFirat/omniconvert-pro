import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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

  const modal = (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={dict.paywall.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) setPaywallOpen(false);
      }}
    >
      <div className="modal-sheet">
        <div className="modal-sheet-header">
          <div className="sheet-grabber" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                {dict.paywall.title}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {dict.paywall.subtitle}
              </p>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={dict.paywall.close}
              onClick={() => setPaywallOpen(false)}
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="modal-sheet-body">
          {/* Clean 4-Point Pro Benefits */}
          <div className="ios-group" style={{ background: 'var(--sheet-card)' }}>
            {features.map((feat) => (
              <div key={feat} className="ios-row" style={{ minHeight: 46, padding: '11px 14px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 10, fontSize: '0.88rem', lineHeight: 1.4, color: 'var(--text-primary)' }}>
                  <Check size={17} color="var(--accent)" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{feat}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Fair 3-Plan Selector with Live StoreKit 2 Prices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                    minHeight: 68,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--separator)'}`,
                    background: active ? 'var(--accent-soft)' : 'var(--sheet-card)',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>{title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                      {sub}
                    </div>
                  </div>
                  <div className="tabular" style={{ fontWeight: 700, fontSize: '1.02rem', color: active ? 'var(--accent)' : 'var(--text-primary)', flexShrink: 0 }}>
                    {livePrice}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
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
            style={{ width: '100%' }}
          >
            {dict.paywall.restorePurchases}
          </button>

          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.48, textAlign: 'center' }}>
            {dict.paywall.autoRenewalDisclosure}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: '0.8rem' }}>
            <a
              href={APP_CONFIG.privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', padding: '6px 4px' }}
            >
              {dict.settings.privacyPolicy}
            </a>
            <a
              href={APP_CONFIG.termsOfUseUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', padding: '6px 4px' }}
            >
              {dict.settings.termsOfUse}
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};

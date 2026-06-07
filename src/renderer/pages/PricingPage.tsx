import React, { useState, useEffect } from 'react';
import './PricingPage.css';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface PricingPageProps {
    onContinue: () => void;
}

/* ── Location-aware pricing ── */
const useIsIndia = () => {
    const [isIndia, setIsIndia] = useState(false);
    useEffect(() => {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta')) {
                setIsIndia(true);
            }
        } catch { /* fallback: not India */ }
    }, []);
    return isIndia;
};

const Check = () => (
    <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const Dot = ({ purple }: { purple?: boolean }) => (
    <span className={`pp-dot ${purple ? 'pp-dot-purple' : ''}`} />
);

const PricingPage: React.FC<PricingPageProps> = ({ onContinue }) => {
    const [isAnnual, setIsAnnual] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const isIndia = useIsIndia();

    const FREE_USAGE = [
        '25 uses/day total',
        '10 AI (F7)',
        '15 Grammar (F8)',
        '200 uses/month (combined)',
    ];
    const FREE_INCLUDES = [
        'Speak → paste in any app',
        'Select text → speak to rewrite',
        'AI + grammar improvements',
        'Prompt generation (limited)',
        'App-aware formatting',
        'Local notes',
        'Local dictionary (custom words)',
        'Local snippets (saved text)',
        'No cloud sync',
    ];

    const PRO_USAGE = [
        'Unlimited AI (F7)',
        'Unlimited Grammar (F8)',
        'Longer, more detailed outputs',
        'Priority processing',
    ];
    const PRO_INCLUDES = [
        'Everything in Free, plus:',
        'Cloud sync (notes, dictionary, snippets)',
        'Cross-device access',
        'Higher-quality rewrites',
        'Advanced prompt generation',
        'Stronger app-context optimization',
        'Early access to new features',
    ];

    const freePrice = isIndia ? '₹0' : '$0';
    const proPrice = isIndia
        ? (isAnnual ? '₹300' : '₹359')
        : (isAnnual ? '$8' : '$10');
    const proPeriod = isAnnual ? '/mo (billed annually)' : '/mo';

    const handleUpgrade = async () => {
        if (!ipcRenderer) return;
        setUpgrading(true);
        try {
            const planType = isAnnual ? 'pro_annual' : 'pro_monthly';
            const result = await ipcRenderer.invoke('auth:create-subscription', { planType });
            if (result?.success) {
                // Payment page opened in browser — keep loading state
                // Poll for plan upgrade in background
                const pollInterval = setInterval(async () => {
                    try {
                        const profile = await ipcRenderer.invoke('auth:get-user');
                        if (profile?.plan === 'pro') {
                            clearInterval(pollInterval);
                            setUpgrading(false);
                            onContinue();
                        }
                    } catch { /* ignore */ }
                }, 3000);
                // Auto-reset after 60s if payment didn't complete
                setTimeout(() => { clearInterval(pollInterval); setUpgrading(false); }, 60000);
            } else {
                alert(result?.error || 'Failed to start payment. Please try again.');
                setUpgrading(false);
            }
        } catch (e: any) {
            alert(e.message || 'Something went wrong');
            setUpgrading(false);
        }
    };

    return (
        <div className="pp-page">
            {/* Background grid */}
            <div className="pp-grid" />
            {/* Purple glows */}
            <div className="pp-glow pp-glow-top" />
            <div className="pp-glow pp-glow-left" />
            <div className="pp-glow pp-glow-right" />

            <div className="pp-content">
                {/* Badge */}
                <span className="pp-badge">Pricing</span>

                {/* Header */}
                <h1 className="pp-title">
                    Simple, <span className="pp-title-accent">honest pricing.</span>
                </h1>
                <p className="pp-subtitle">Start free. Upgrade when you're ready. No surprises.</p>

                {/* Billing toggle */}
                <div className="pp-toggle-row">
                    <span className={`pp-toggle-label ${!isAnnual ? 'active' : ''}`}>Monthly</span>
                    <button className={`pp-toggle-btn ${isAnnual ? 'active' : ''}`} onClick={() => setIsAnnual(!isAnnual)}>
                        <span className="pp-toggle-knob" />
                    </button>
                    <span className={`pp-toggle-label ${isAnnual ? 'active' : ''}`}>Annual</span>
                    {isAnnual && <span className="pp-toggle-save">SAVE MORE</span>}
                </div>

                {/* Cards */}
                <div className="pp-cards">
                    {/* Free Plan */}
                    <div className="pp-card">
                        <div className="pp-card-inner">
                            {/* Header zone */}
                            <div className="pp-card-header">
                                <div className="pp-plan-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                    </svg>
                                </div>
                                <span className="pp-plan-label">FREE PLAN</span>
                            </div>
                            <div className="pp-price-row">
                                <span className="pp-price">{freePrice}</span>
                                <span className="pp-period">/forever</span>
                            </div>

                            {/* CTA */}
                            <button className="pp-card-btn pp-btn-free" onClick={onContinue}>
                                Continue Free
                            </button>

                            {/* Divider */}
                            <div className="pp-divider" />

                            {/* Usage */}
                            <p className="pp-section-label">Usage</p>
                            <div className="pp-features">
                                {FREE_USAGE.map((f, i) => (
                                    <div className="pp-feat" key={i}><Dot /><span>{f}</span></div>
                                ))}
                            </div>

                            <div className="pp-divider" />

                            {/* Includes */}
                            <p className="pp-section-label">Includes</p>
                            <div className="pp-features">
                                {FREE_INCLUDES.map((f, i) => (
                                    <div className="pp-feat" key={i}>
                                        <span className="pp-check-icon"><Check /></span>
                                        <span>{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="pp-card pp-card-pro">
                        {/* Top gradient bar */}
                        <div className="pp-pro-bar" />
                        {/* Popular badge */}
                        <span className="pp-popular-badge">⭐ POPULAR</span>

                        <div className="pp-card-inner pp-card-inner-pro">
                            {/* Header zone */}
                            <div className="pp-card-header">
                                <div className="pp-plan-icon pp-icon-pro">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                </div>
                                <span className="pp-plan-label pp-label-pro">PRO PLAN</span>
                            </div>
                            <div className="pp-price-row">
                                <span className="pp-price">{proPrice}</span>
                                <span className="pp-period">{proPeriod}</span>
                            </div>

                            {/* CTA */}
                            <button
                                className="pp-card-btn pp-btn-pro"
                                onClick={handleUpgrade}
                                disabled={upgrading}
                            >
                                {upgrading ? 'Opening payment...' : '✨ Upgrade to Pro'}
                            </button>

                            <div className="pp-divider pp-divider-pro" />

                            {/* Usage */}
                            <p className="pp-section-label pp-section-pro">Usage</p>
                            <div className="pp-features">
                                {PRO_USAGE.map((f, i) => (
                                    <div className="pp-feat" key={i}><Dot purple /><span>{f}</span></div>
                                ))}
                            </div>

                            <div className="pp-divider pp-divider-pro" />

                            {/* Includes */}
                            <p className="pp-section-label pp-section-pro">Includes</p>
                            <div className="pp-features">
                                {PRO_INCLUDES.map((f, i) => (
                                    <div className="pp-feat" key={i}>
                                        <span className="pp-check-icon pp-check-pro"><Check /></span>
                                        <span>{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Location note */}
                <p className="pp-note">
                    🌐 {isIndia
                        ? 'Prices shown in ₹ (India) · Cancel anytime · No credit card for free plan'
                        : 'Prices shown in $ (USD) · Cancel anytime · No credit card for free plan'}
                </p>
            </div>
        </div>
    );
};

export default PricingPage;

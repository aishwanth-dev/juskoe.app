import React, { useState } from 'react';
import './OnboardingPage.css';
// @ts-ignore
import logo from '../assets/juskoe_logo.png';

interface OnboardingPageProps {
    onComplete: () => void;
}

const TOTAL_SLIDES = 4;

/* ---- SVG Icons (no emojis) ---- */
const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
);
const BrainIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M12 2a4 4 0 0 0-4 4c0 1.1.45 2.1 1.17 2.83L12 12l2.83-3.17A4 4 0 0 0 16 6a4 4 0 0 0-4-4z"/>
        <path d="M8 6a4 4 0 0 0-4 4c0 2.21 1.79 4 4 4"/>
        <path d="M16 6a4 4 0 0 1 4 4c0 2.21-1.79 4-4 4"/>
        <path d="M8 14a4 4 0 0 0-1 7.93"/>
        <path d="M16 14a4 4 0 0 1 1 7.93"/>
        <line x1="12" y1="12" x2="12" y2="22"/>
    </svg>
);
const ShieldIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
);
const BookIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
);
const ZapIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
);
const FileTextIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
    </svg>
);
const CloudIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
);
const MonitorIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
);
const LockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
);
const SparklesIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
    </svg>
);
const EditIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
);
const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
);
const LayersIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete }) => {
    const [slide, setSlide] = useState(0);

    const next = () => {
        if (slide < TOTAL_SLIDES - 1) setSlide(slide + 1);
        else onComplete();
    };

    const renderDots = () => (
        <div className="ob-dots">
            {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                <div
                    key={i}
                    className={`ob-dot ${i === slide ? 'active' : i < slide ? 'done' : ''}`}
                />
            ))}
        </div>
    );

    /* ---- Slide 1: Welcome ---- */
    const renderWelcome = () => (
        <div className="ob-card" key="s0">
            <img src={logo} alt="Juskoe" className="ob-logo" />
            <h1 className="ob-title">Welcome to Juskoe</h1>
            <p className="ob-subtitle">
                Your AI voice assistant.<br />Just speak, it happens.
            </p>

            <div className="ob-features">
                <div className="ob-feature">
                    <div className="ob-feature-icon"><MicIcon /></div>
                    <div>
                        <h4>Voice to Text</h4>
                        <p>Speak naturally, get accurate text instantly</p>
                    </div>
                </div>
                <div className="ob-feature">
                    <div className="ob-feature-icon"><BrainIcon /></div>
                    <div>
                        <h4>AI Powered</h4>
                        <p>Smart grammar fixing and text enhancement</p>
                    </div>
                </div>
                <div className="ob-feature">
                    <div className="ob-feature-icon"><ShieldIcon /></div>
                    <div>
                        <h4>Private and Offline</h4>
                        <p>Voice stays on your device, always</p>
                    </div>
                </div>
            </div>

            <button className="ob-btn" onClick={next}>Get Started</button>
        </div>
    );

    /* ---- Slide 2: Your Workspace ---- */
    const renderWorkspace = () => (
        <div className="ob-card" key="s1">
            <div className="ob-icon-box"><BookIcon /></div>
            <h1 className="ob-title">Your Workspace</h1>
            <p className="ob-subtitle">
                Personal tools that make writing faster.
            </p>

            <div className="ob-features">
                <div className="ob-feature">
                    <div className="ob-feature-icon"><LayersIcon /></div>
                    <div>
                        <h4>Personal Dictionary</h4>
                        <p>Save words you learn — always accessible</p>
                    </div>
                </div>
                <div className="ob-feature">
                    <div className="ob-feature-icon"><ZapIcon /></div>
                    <div>
                        <h4>Snippets Library</h4>
                        <p>Store reusable text blocks, paste in one click</p>
                    </div>
                </div>
                <div className="ob-feature">
                    <div className="ob-feature-icon"><FileTextIcon /></div>
                    <div>
                        <h4>Quick Notes</h4>
                        <p>Capture ideas on the fly, organized and searchable</p>
                    </div>
                </div>
            </div>

            <button className="ob-btn" onClick={next}>Continue</button>
        </div>
    );

    /* ---- Slide 3: Cloud & Sync ---- */
    const renderCloud = () => (
        <div className="ob-card" key="s2">
            <div className="ob-icon-box"><CloudIcon /></div>
            <h1 className="ob-title">Sync Everywhere</h1>
            <p className="ob-subtitle">
                Your data, available on every device.
            </p>

            <div className="ob-features">
                <div className="ob-feature">
                    <div className="ob-feature-icon"><RefreshIcon /></div>
                    <div>
                        <h4>Cloud Sync</h4>
                        <p>Dictionary, snippets and notes sync in real-time</p>
                    </div>
                </div>
                <div className="ob-feature">
                    <div className="ob-feature-icon"><MonitorIcon /></div>
                    <div>
                        <h4>Cross-Platform</h4>
                        <p>Works on Windows, Mac and Android</p>
                    </div>
                </div>
                <div className="ob-feature">
                    <div className="ob-feature-icon"><LockIcon /></div>
                    <div>
                        <h4>Encrypted and Secure</h4>
                        <p>Your data is protected with row-level security</p>
                    </div>
                </div>
            </div>

            <button className="ob-btn" onClick={next}>Continue</button>
        </div>
    );

    /* ---- Slide 4: How It Works ---- */
    const renderHowItWorks = () => (
        <div className="ob-card" key="s3">
            <div className="ob-icon-box"><SparklesIcon /></div>
            <h1 className="ob-title">How It Works</h1>
            <p className="ob-subtitle">
                Press <strong>Ctrl+Shift+S</strong> anywhere to start.
            </p>

            <div className="ob-modes">
                <div className="ob-mode-card">
                    <div className="ob-mode-icon"><SparklesIcon /></div>
                    <h4>AI Mode</h4>
                    <p>Speak — AI rewrites your text with perfect grammar and style</p>
                </div>
                <div className="ob-mode-card">
                    <div className="ob-mode-icon"><EditIcon /></div>
                    <h4>Grammar Mode</h4>
                    <p>Speak — get clean, grammatically correct text</p>
                </div>
                <div className="ob-mode-card">
                    <div className="ob-mode-icon"><RefreshIcon /></div>
                    <h4>Select and Rewrite</h4>
                    <p>Select any text — AI rewrites it in your style</p>
                </div>
                <div className="ob-mode-card">
                    <div className="ob-mode-icon"><FileTextIcon /></div>
                    <h4>Notes and Snippets</h4>
                    <p>Save, organize and access your content instantly</p>
                </div>
            </div>

            <button className="ob-btn" onClick={next}>Let's Go</button>
        </div>
    );

    const slides = [renderWelcome, renderWorkspace, renderCloud, renderHowItWorks];

    return (
        <div className="ob-page">
            <img src={logo} alt="Juskoe" className="ob-corner-logo" />
            {renderDots()}
            {slides[slide]()}
        </div>
    );
};

export default OnboardingPage;

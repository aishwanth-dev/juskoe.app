import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    authUser?: any;
    isAuthenticated: boolean;
    onLogout: () => void;
}

type TabType = 'general' | 'style' | 'plans' | 'cloud' | 'account';
type StyleCategory = 'personal' | 'work' | 'email' | 'other';
type WritingStyleType = 'formal' | 'casual' | 'relaxed';

// Whisper-supported languages (Sherpa-ONNX Whisper Base — 99 languages)
const LANGUAGES = [
    'Auto',
    'English', 'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Assamese',
    'Azerbaijani', 'Bashkir', 'Basque', 'Belarusian', 'Bengali', 'Bosnian', 'Breton',
    'Bulgarian', 'Burmese', 'Cantonese', 'Catalan', 'Chinese', 'Croatian', 'Czech',
    'Danish', 'Dutch', 'Estonian', 'Faroese', 'Finnish', 'French', 'Galician',
    'Georgian', 'German', 'Greek', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hawaiian',
    'Hebrew', 'Hindi', 'Hungarian', 'Icelandic', 'Indonesian', 'Italian', 'Japanese',
    'Javanese', 'Kannada', 'Kazakh', 'Khmer', 'Korean', 'Lao', 'Latin', 'Latvian',
    'Lingala', 'Lithuanian', 'Luxembourgish', 'Macedonian', 'Malagasy', 'Malay',
    'Malayalam', 'Maltese', 'Maori', 'Marathi', 'Mongolian', 'Nepali', 'Norwegian',
    'Nynorsk', 'Occitan', 'Pashto', 'Persian', 'Polish', 'Portuguese', 'Punjabi',
    'Romanian', 'Russian', 'Sanskrit', 'Serbian', 'Shona', 'Sindhi', 'Sinhala',
    'Slovak', 'Slovenian', 'Somali', 'Spanish', 'Sundanese', 'Swahili', 'Swedish',
    'Tagalog', 'Tajik', 'Tamil', 'Tatar', 'Telugu', 'Thai', 'Tibetan', 'Turkish',
    'Turkmen', 'Ukrainian', 'Urdu', 'Uzbek', 'Vietnamese', 'Welsh', 'Yiddish', 'Yoruba',
];
const INPUT_LANGUAGES = LANGUAGES;

// Style categories — original Juskoe categories
const STYLE_CATEGORIES: { key: StyleCategory; label: string; description: string }[] = [
    { key: 'personal', label: 'Texting', description: 'How Juskoe formats your texts and DMs' },
    { key: 'work', label: 'Professional', description: 'For Slack, Teams, and work chats' },
    { key: 'email', label: 'Emails', description: 'Applied when composing emails' },
    { key: 'other', label: 'General', description: 'Default style for all other apps' },
];

const STYLE_OPTIONS: Record<StyleCategory, { key: WritingStyleType; title: string; subtitle: string; preview: string }[]> = {
    personal: [
        {
            key: 'formal',
            title: 'Polished',
            subtitle: 'Full punctuation · Proper casing',
            preview: 'Can we catch up this weekend? I was thinking Saturday around 4, let me know if that works.',
        },
        {
            key: 'casual',
            title: 'Natural',
            subtitle: 'Light punctuation · Relaxed casing',
            preview: 'Can we catch up this weekend? I was thinking Saturday around 4 let me know',
        },
        {
            key: 'relaxed',
            title: 'Laid-back',
            subtitle: 'Minimal formatting · Lowercase',
            preview: 'can we catch up this weekend? was thinking saturday around 4 lmk',
        },
    ],
    work: [
        {
            key: 'formal',
            title: 'Polished',
            subtitle: 'Full punctuation · Proper casing',
            preview: 'Just finished reviewing the report. I\'ll share my notes before the 3 PM standup.',
        },
        {
            key: 'casual',
            title: 'Natural',
            subtitle: 'Light punctuation · Relaxed casing',
            preview: 'Just finished reviewing the report. I\'ll share my notes before the 3 PM standup',
        },
        {
            key: 'relaxed',
            title: 'Energetic',
            subtitle: 'Adds emphasis · Exclamation marks',
            preview: 'Just finished reviewing the report! I\'ll share my notes before the 3 PM standup!',
        },
    ],
    email: [
        {
            key: 'formal',
            title: 'Polished',
            subtitle: 'Full punctuation · Proper casing',
            preview: 'Hi Priya,\n\nThank you for sending over the proposal. I\'ve reviewed it and have a few suggestions. Let\'s schedule a call this week.\n\nRegards,\nAishwarya',
        },
        {
            key: 'casual',
            title: 'Natural',
            subtitle: 'Light punctuation · Relaxed tone',
            preview: 'Hi Priya,\n\nThanks for the proposal, I\'ve gone through it and have some thoughts. Let\'s hop on a call this week.\n\nCheers,\nAishwarya',
        },
        {
            key: 'relaxed',
            title: 'Energetic',
            subtitle: 'Adds emphasis · Exclamation marks',
            preview: 'Hi Priya!\n\nThanks for sending the proposal! Loved it overall — have a few ideas to discuss. Let\'s connect this week!\n\nCheers,\nAishwarya',
        },
    ],
    other: [
        {
            key: 'formal',
            title: 'Polished',
            subtitle: 'Full punctuation · Proper casing',
            preview: 'I finally got around to reading that article you shared. The points about remote work balance were really well made.',
        },
        {
            key: 'casual',
            title: 'Natural',
            subtitle: 'Light punctuation · Relaxed casing',
            preview: 'I finally got around to reading that article you shared. The points about remote work balance were really well made',
        },
        {
            key: 'relaxed',
            title: 'Energetic',
            subtitle: 'Adds emphasis · Exclamation marks',
            preview: 'I finally got around to reading that article you shared! The points about remote work balance were really well made!',
        },
    ],
};

const PLAN_FEATURES_FREE = {
    usage: [
        '25 uses/day total',
        '10 AI (F7)',
        '15 Grammar (F8)',
        '200 uses/month (combined)',
    ],
    includes: [
        'Speak → paste in any app',
        'Select text → speak to rewrite',
        'AI + grammar improvements',
        'Prompt generation (limited)',
        'App-aware formatting',
        'Local notes',
        'Local dictionary (custom words)',
        'Local snippets (saved text)',
        'Offline speech-to-text',
        'No cloud sync',
    ],
};

const PLAN_FEATURES_PRO = {
    usage: [
        'Unlimited AI (F7)',
        'Unlimited Grammar (F8)',
        'Longer, more detailed outputs',
        'Priority processing',
    ],
    includes: [
        'Everything in Free, plus:',
        'Cloud sync (notes, dictionary, snippets)',
        'Cross-device access',
        'Higher-quality rewrites',
        'Advanced prompt generation',
        'Stronger app-context optimization',
        'Early access to new features',
    ],
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, authUser, isAuthenticated, onLogout }) => {
    const [activeTab, setActiveTab] = useState<TabType>('general');

    // General
    const [translateTo, setTranslateTo] = useState('English');
    const [overlayPosition, setOverlayPosition] = useState('bottom');
    const [showIdlePill, setShowIdlePill] = useState(true);
    const [autoLaunch, setAutoLaunch] = useState(false);
    const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
    const [selectedMic, setSelectedMic] = useState('default');
    const [inputLanguage, setInputLanguage] = useState('English');

    // Writing Style
    const [styleCategory, setStyleCategory] = useState<StyleCategory>('personal');
    const [writingStyles, setWritingStyles] = useState<Record<StyleCategory, WritingStyleType>>({
        personal: 'casual',
        work: 'formal',
        email: 'formal',
        other: 'casual',
    });

    // Plans
    const [planBilling, setPlanBilling] = useState<'monthly' | 'annual'>('monthly');
    const [userCountry, setUserCountry] = useState<'IN' | 'OTHER'>('OTHER');
    const [upgrading, setUpgrading] = useState(false);
    const [userPlanType, setUserPlanType] = useState<'pro_monthly' | 'pro_annual' | null>(null);
    const [periodStart, setPeriodStart] = useState<string | null>(null);
    const [periodEnd, setPeriodEnd] = useState<string | null>(null);

    // System Prompt
    const [systemPrompt, setSystemPrompt] = useState('');

    // Cloud
    const [cloudSync, setCloudSync] = useState(false);
    const [userIsPro, setUserIsPro] = useState(false);

    // Account — real usage data (initialize from cache to prevent 0→X flash)
    const [usageData, setUsageData] = useState<{
        dailyAI: number; dailyGrammar: number; monthlyTotal: number;
    }>(() => {
        try {
            const cached = localStorage.getItem('juskoe_usage_cache');
            if (cached) return JSON.parse(cached);
        } catch { }
        return { dailyAI: 0, dailyGrammar: 0, monthlyTotal: 0 };
    });
    const [userPlan, setUserPlan] = useState<'free' | 'pro'>(() => {
        try { return (localStorage.getItem('juskoe_plan_cache') as 'free' | 'pro') || 'free'; } catch { return 'free'; }
    });
    const avatarUrl = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null;

    // Account — derive from authUser prop
    const accountName = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'User';
    const accountEmail = authUser?.email || 'Not signed in';

    useEffect(() => {
        if (isOpen) loadAllSettings();
    }, [isOpen]);

    const loadAllSettings = async () => {
        if (!ipcRenderer) return;

        // Check pro status first (try-catch in case main process hasn't registered handler yet)
        try {
            const proStatus = await ipcRenderer.invoke('settings:isPro');
            setUserIsPro(!!proStatus);
        } catch {
            setUserIsPro(false);
        }

        const lang = await ipcRenderer.invoke('settings:get', 'translateTo');
        const overlayPos = await ipcRenderer.invoke('settings:get', 'overlayPosition');
        const idlePill = await ipcRenderer.invoke('settings:get', 'showIdlePill');
        const cloud = await ipcRenderer.invoke('settings:get', 'cloudSync');
        const mic = await ipcRenderer.invoke('settings:get', 'selectedMic');
        const style = await ipcRenderer.invoke('settings:get', 'writingStyle');
        const sysPrompt = await ipcRenderer.invoke('settings:get', 'systemPrompt');

        if (lang) setTranslateTo(lang);
        if (overlayPos) setOverlayPosition(overlayPos);
        if (idlePill !== null && idlePill !== undefined) setShowIdlePill(idlePill !== 'false');
        if (cloud === 'true') setCloudSync(true);
        if (mic) setSelectedMic(mic);
        if (style) {
            try {
                const parsed = JSON.parse(style);
                setWritingStyles(parsed);
            } catch {
                // Legacy: single string style value
                setWritingStyles({ personal: 'casual', work: 'formal', email: 'formal', other: 'casual' });
            }
        }
        if (sysPrompt) setSystemPrompt(sysPrompt);

        const inputLang = await ipcRenderer.invoke('settings:get', 'inputLanguage');
        if (inputLang) setInputLanguage(inputLang);

        // Auto-launch
        const isAutoLaunch = await ipcRenderer.invoke('app:getAutoLaunch');
        setAutoLaunch(isAutoLaunch);

        // Microphones
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const mics = devices.filter(d => d.kind === 'audioinput');
            setMicrophones(mics);
        } catch (e) {
            console.error('Failed to list mics:', e);
        }

        // Fetch real usage data for Account tab (cache prevents 0→X flash)
        try {
            const usage = await ipcRenderer.invoke('auth:get-usage');
            if (usage && typeof usage === 'object') {
                const parsed = {
                    dailyAI: Number(usage.dailyAI ?? usage.daily_ai ?? 0),
                    dailyGrammar: Number(usage.dailyGrammar ?? usage.daily_grammar ?? 0),
                    monthlyTotal: Number(usage.monthlyTotal ?? usage.monthly_total ?? 0),
                };
                setUsageData(parsed);
                try { localStorage.setItem('juskoe_usage_cache', JSON.stringify(parsed)); } catch { }
            }
        } catch { /* silently fall back to cached/0 defaults */ }

        // Fetch user plan from profile
        try {
            const profile = await ipcRenderer.invoke('auth:get-user');
            if (profile?.plan) {
                setUserPlan(profile.plan);
                try { localStorage.setItem('juskoe_plan_cache', profile.plan); } catch { }
            }
            if (profile?.planType) {
                setUserPlanType(profile.planType);
            }
            if (profile?.periodStart) {
                setPeriodStart(profile.periodStart);
            }
            if (profile?.periodEnd) {
                setPeriodEnd(profile.periodEnd);
            }
        } catch { /* fall back to free */ }

        // Detect user location for pricing (by timezone)
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz?.includes('Calcutta') || tz?.includes('Kolkata') || tz?.includes('Asia/Kolkata')) {
                setUserCountry('IN');
            } else {
                setUserCountry('OTHER');
            }
        } catch { setUserCountry('OTHER'); }
    };

    const saveSetting = async (key: string, value: string) => {
        if (ipcRenderer) {
            await ipcRenderer.invoke('settings:set', key, value);
        }
    };

    const handleTranslateChange = (lang: string) => {
        setTranslateTo(lang);
        saveSetting('translateTo', lang);
    };

    const handleMicChange = (deviceId: string) => {
        setSelectedMic(deviceId);
        saveSetting('selectedMic', deviceId);
    };

    const handleInputLangChange = (lang: string) => {
        setInputLanguage(lang);
        saveSetting('inputLanguage', lang);
    };

    const handleAutoLaunch = async () => {
        const newValue = !autoLaunch;
        setAutoLaunch(newValue);
        if (ipcRenderer) {
            await ipcRenderer.invoke('app:setAutoLaunch', newValue);
        }
    };

    const handleOverlayPosition = async (position: string) => {
        setOverlayPosition(position);
        if (ipcRenderer) {
            await ipcRenderer.invoke('overlay:setPosition', position);
        }
    };

    const handleIdlePillToggle = async () => {
        const newValue = !showIdlePill;
        setShowIdlePill(newValue);
        saveSetting('showIdlePill', newValue.toString());
        if (ipcRenderer) {
            ipcRenderer.send('overlay:setIdleVisible', newValue);
        }
    };

    const handleWritingStyle = (category: StyleCategory, style: WritingStyleType) => {
        const updated = { ...writingStyles, [category]: style };
        setWritingStyles(updated);
        saveSetting('writingStyle', JSON.stringify(updated));
    };

    const handleCloudSync = async () => {
        // Block free users entirely — defence in depth
        if (!userIsPro) return;

        const newValue = !cloudSync;
        if (ipcRenderer) {
            const result = await ipcRenderer.invoke('settings:set', 'cloudSync', newValue.toString());
            if (result?.error === 'pro_required') {
                // Backend rejected — keep toggle off
                setCloudSync(false);
                return;
            }
            // If turning ON, trigger immediate sync
            if (newValue) {
                ipcRenderer.invoke('sync:trigger').catch(() => { });
            }
        }
        setCloudSync(newValue);
    };

    const [cancelling, setCancelling] = React.useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
    const [cancelMsg, setCancelMsg] = React.useState<{ text: string; ok: boolean } | null>(null);

    const handleUpgradePro = async () => {
        if (!ipcRenderer || upgrading) return;
        setUpgrading(true);
        try {
            const planType = planBilling === 'monthly' ? 'pro_monthly' : 'pro_annual';
            const result = await ipcRenderer.invoke('auth:create-subscription', { planType });
            if (result?.success) {
                // Payment page opened — poll for Pro status
                const pollInterval = setInterval(async () => {
                    try {
                        const profile = await ipcRenderer.invoke('auth:get-user');
                        if (profile?.plan === 'pro') {
                            clearInterval(pollInterval);
                            setUpgrading(false);
                            setUserPlan('pro');
                            if (profile.planType) setUserPlanType(profile.planType);
                            if (profile.periodStart) setPeriodStart(profile.periodStart);
                            if (profile.periodEnd) setPeriodEnd(profile.periodEnd);
                        }
                    } catch { /* ignore */ }
                }, 3000);
                // Auto-reset after 60s
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

    const handleCancelPlan = async () => {
        if (!ipcRenderer || cancelling) return;
        setCancelling(true);
        setCancelMsg(null);
        try {
            const result = await ipcRenderer.invoke('auth:cancel-subscription');
            if (result?.success) {
                setCancelMsg({ text: 'Plan cancelled. You are now on the Free plan.', ok: true });
                setShowCancelConfirm(false);
                setUserPlan('free');
                setUserPlanType(null);
                setPeriodStart(null);
                setPeriodEnd(null);
            } else {
                setCancelMsg({ text: result?.error || 'Failed to cancel. Try again.', ok: false });
            }
        } catch (e: any) {
            setCancelMsg({ text: e.message || 'Something went wrong.', ok: false });
        }
        setCancelling(false);
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
                {/* Sidebar */}
                <div className="settings-sidebar">
                    <div className="settings-section">
                        <span className="settings-section-title">SETTINGS</span>
                        <button
                            className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
                            onClick={() => setActiveTab('general')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                            General
                        </button>
                        <button
                            className={`settings-tab ${activeTab === 'style' ? 'active' : ''}`}
                            onClick={() => setActiveTab('style')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                <path d="M2 2l7.586 7.586" />
                                <circle cx="11" cy="11" r="2" />
                            </svg>
                            Writing Style
                        </button>
                    </div>

                    <div className="settings-divider" />

                    <div className="settings-section">
                        <span className="settings-section-title">ACCOUNT</span>
                        <button
                            className={`settings-tab ${activeTab === 'plans' ? 'active' : ''}`}
                            onClick={() => setActiveTab('plans')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            Plans
                        </button>
                        <button
                            className={`settings-tab ${activeTab === 'cloud' ? 'active' : ''}`}
                            onClick={() => setActiveTab('cloud')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                            </svg>
                            Cloud Sync
                        </button>
                        <button
                            className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Account
                        </button>
                    </div>

                    <div className="settings-version">
                        <span>Juskoe v1.0.0</span>
                        <button className="settings-update-btn" title="Check for updates">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                <polyline points="21 3 21 9 15 9" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="settings-content">
                    <button className="settings-close" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    {/* ===== GENERAL TAB ===== */}
                    {activeTab === 'general' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">General</h2>

                            <div className="settings-card">
                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Input language</h4>
                                        <p className="setting-desc">Language you speak into the mic</p>
                                    </div>
                                    <select
                                        className="setting-select"
                                        value={inputLanguage}
                                        onChange={e => handleInputLangChange(e.target.value)}
                                    >
                                        {INPUT_LANGUAGES.map(lang => (
                                            <option key={lang} value={lang}>{lang}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Always translate to</h4>
                                        <p className="setting-desc">Output language for all voice transcriptions</p>
                                    </div>
                                    <select
                                        className="setting-select"
                                        value={translateTo}
                                        onChange={e => handleTranslateChange(e.target.value)}
                                    >
                                        {LANGUAGES.map(lang => (
                                            <option key={lang} value={lang}>{lang}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Microphone</h4>
                                        <p className="setting-desc">Select your input device</p>
                                    </div>
                                    <select
                                        className="setting-select"
                                        value={selectedMic}
                                        onChange={e => handleMicChange(e.target.value)}
                                    >
                                        <option value="default">Auto-detect</option>
                                        {microphones.map((mic, i) => (
                                            <option key={mic.deviceId || i} value={mic.deviceId}>
                                                {mic.label || `Microphone ${i + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Launch on startup</h4>
                                        <p className="setting-desc">Start Juskoe when you log in</p>
                                    </div>
                                    <button
                                        className={`btn-toggle ${autoLaunch ? 'active' : ''}`}
                                        onClick={handleAutoLaunch}
                                    >
                                        <span className="toggle-knob"></span>
                                    </button>
                                </div>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Overlay position</h4>
                                        <p className="setting-desc">Where the recording indicator appears</p>
                                    </div>
                                    <div className="position-btns">
                                        <button
                                            className={`pos-btn ${overlayPosition === 'top' ? 'active' : ''}`}
                                            onClick={() => handleOverlayPosition('top')}
                                        >Top</button>
                                        <button
                                            className={`pos-btn ${overlayPosition === 'bottom' ? 'active' : ''}`}
                                            onClick={() => handleOverlayPosition('bottom')}
                                        >Bottom</button>
                                        <button
                                            className={`pos-btn ${overlayPosition === 'hidden' ? 'active' : ''}`}
                                            onClick={() => handleOverlayPosition('hidden')}
                                        >Hidden</button>
                                    </div>
                                </div>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Show idle indicator</h4>
                                        <p className="setting-desc">Show the small pill when not recording</p>
                                    </div>
                                    <button
                                        className={`btn-toggle ${showIdlePill ? 'active' : ''}`}
                                        onClick={handleIdlePillToggle}
                                    >
                                        <span className="toggle-knob"></span>
                                    </button>
                                </div>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Keyboard shortcuts</h4>
                                        <p className="setting-desc">
                                            <strong>F7</strong> AI mode · <strong>F8</strong> Grammar · <strong>F9</strong> Notes · <strong>ESC</strong> Cancel
                                        </p>
                                    </div>
                                </div>

                                <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                                    <div className="setting-info">
                                        <h4 className="setting-title">System prompt</h4>
                                        <p className="setting-desc">Custom instructions for how the AI should behave (optional)</p>
                                    </div>
                                    <textarea
                                        className="setting-textarea"
                                        value={systemPrompt}
                                        onChange={e => {
                                            setSystemPrompt(e.target.value);
                                            saveSetting('systemPrompt', e.target.value);
                                        }}
                                        placeholder="e.g. Always respond in bullet points, keep answers concise, use technical language..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== WRITING STYLE TAB ===== */}
                    {activeTab === 'style' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Style</h2>

                            {/* Category sub-tabs */}
                            <div className="style-category-tabs">
                                {STYLE_CATEGORIES.map(cat => (
                                    <button
                                        key={cat.key}
                                        className={`style-cat-tab ${styleCategory === cat.key ? 'active' : ''}`}
                                        onClick={() => setStyleCategory(cat.key)}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* Category description */}
                            <div className="style-category-info">
                                <p className="style-cat-desc">{STYLE_CATEGORIES.find(c => c.key === styleCategory)?.description}</p>
                                <p className="style-cat-note">Style formatting applies across all languages. Juskoe adapts your writing style automatically.</p>
                            </div>

                            {/* Style option cards */}
                            <div className="style-cards-row">
                                {STYLE_OPTIONS[styleCategory].map(opt => (
                                    <button
                                        key={opt.key}
                                        className={`style-card ${writingStyles[styleCategory] === opt.key ? 'active' : ''}`}
                                        onClick={() => handleWritingStyle(styleCategory, opt.key)}
                                    >
                                        <div className="style-card-info">
                                            <h3 className="style-card-title">{opt.title}</h3>
                                            <p className="style-card-subtitle">{opt.subtitle}</p>
                                        </div>
                                        <div className="style-card-preview">
                                            {opt.preview.split('\n').map((line, i) => (
                                                <span key={i}>{line}<br /></span>
                                            ))}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ===== PLANS TAB ===== */}
                    {activeTab === 'plans' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Plans & Billing</h2>

                            {/* Monthly / Annual toggle */}
                            <div className="plan-billing-toggle">
                                <button
                                    className={`plan-toggle-btn ${planBilling === 'monthly' ? 'active' : ''}`}
                                    onClick={() => setPlanBilling('monthly')}
                                >Monthly</button>
                                <button
                                    className={`plan-toggle-btn ${planBilling === 'annual' ? 'active' : ''}`}
                                    onClick={() => setPlanBilling('annual')}
                                >Annual</button>
                            </div>

                            {/* Plan cards */}
                            <div className="plan-cards-row">
                                {/* Free Plan */}
                                <div className={`plan-card ${userPlan === 'free' ? 'plan-card-active' : ''}`}>
                                    <span className="plan-label">🆓 Free Plan</span>
                                    <h3 className="plan-name">Free</h3>
                                    <p className="plan-price">{userCountry === 'IN' ? '₹0' : '$0'}<span className="plan-period">/forever</span></p>

                                    <h4 className="plan-section-title">Usage</h4>
                                    <ul className="plan-features">
                                        {PLAN_FEATURES_FREE.usage.map((f: string, i: number) => (
                                            <li key={`u${i}`}>
                                                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                {f}
                                            </li>
                                        ))}
                                    </ul>

                                    <h4 className="plan-section-title">Includes</h4>
                                    <ul className="plan-features">
                                        {PLAN_FEATURES_FREE.includes.map((f: string, i: number) => (
                                            <li key={`i${i}`}>
                                                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        className={`plan-btn ${userPlan === 'free' ? 'plan-btn-current' : 'plan-btn-cancel'}`}
                                        onClick={userPlan === 'pro' ? () => { setShowCancelConfirm(true); setCancelMsg(null); } : undefined}
                                        disabled={userPlan === 'free'}
                                    >
                                        {userPlan === 'free' ? 'Current Plan' : 'Downgrade'}
                                    </button>
                                </div>

                                {/* Pro Plan */}
                                <div className={`plan-card plan-card-pro ${userPlan === 'pro' ? 'plan-card-active' : ''}`}>
                                    <div className="plan-label-row">
                                        <span className="plan-label">⭐ Pro Plan</span>
                                        {planBilling === 'annual' && <span className="plan-badge">Save ~20%</span>}
                                    </div>
                                    <h3 className="plan-name">Pro</h3>
                                    <p className="plan-price">
                                        {userCountry === 'IN'
                                            ? (planBilling === 'monthly' ? '₹359' : '₹300')
                                            : (planBilling === 'monthly' ? '$10' : '$8')
                                        }
                                        <span className="plan-period">/mo</span>
                                    </p>
                                    {planBilling === 'annual' && (
                                        <p style={{ fontSize: 11, color: '#888', marginTop: -4, marginBottom: 8 }}>
                                            Billed {userCountry === 'IN' ? '₹3,600' : '$96'}/year
                                        </p>
                                    )}

                                    <h4 className="plan-section-title">Usage</h4>
                                    <ul className="plan-features">
                                        {PLAN_FEATURES_PRO.usage.map((f: string, i: number) => (
                                            <li key={`u${i}`}>
                                                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                {f}
                                            </li>
                                        ))}
                                    </ul>

                                    <h4 className="plan-section-title">Includes</h4>
                                    <ul className="plan-features">
                                        {PLAN_FEATURES_PRO.includes.map((f: string, i: number) => (
                                            <li key={`i${i}`}>
                                                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                    {(() => {
                                        const selectedPlanType = planBilling === 'monthly' ? 'pro_monthly' : 'pro_annual';
                                        const isCurrentExactPlan = userPlan === 'pro' && userPlanType === selectedPlanType;
                                        const isMonthlyToAnnual = userPlan === 'pro' && userPlanType === 'pro_monthly' && selectedPlanType === 'pro_annual';

                                        let btnText = 'Upgrade to Pro';
                                        let btnClass = 'plan-btn-upgrade';
                                        let btnDisabled = upgrading;
                                        let btnClick: (() => void) | undefined = handleUpgradePro;

                                        if (isCurrentExactPlan) {
                                            btnText = 'Current Plan';
                                            btnClass = 'plan-btn-current';
                                            btnClick = undefined;
                                        } else if (isMonthlyToAnnual) {
                                            btnText = upgrading ? 'Opening payment...' : 'Upgrade to Annual';
                                        } else if (userPlan === 'pro') {
                                            // Pro annual viewing monthly — just show current
                                            btnText = 'Current Plan';
                                            btnClass = 'plan-btn-current';
                                            btnClick = undefined;
                                        } else if (userPlan === 'free') {
                                            btnText = upgrading ? 'Opening payment...' : 'Upgrade to Pro';
                                        }

                                        return (
                                            <button
                                                className={`plan-btn ${btnClass}`}
                                                onClick={btnClick}
                                                disabled={btnDisabled || !btnClick}
                                                style={upgrading ? { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 } : {}}
                                            >
                                                {upgrading && btnClick && (
                                                    <span style={{
                                                        display: 'inline-block', width: 14, height: 14,
                                                        border: '2px solid rgba(124,58,237,0.25)',
                                                        borderTopColor: '#7C3AED',
                                                        borderRadius: '50%',
                                                        animation: 'spin 0.6s linear infinite',
                                                    }} />
                                                )}
                                                {btnText}
                                            </button>
                                        );
                                    })()}
                                    {/* Billing info for Pro users */}
                                    {userPlan === 'pro' && periodStart && periodEnd && (
                                        <div style={{ marginTop: 8, fontSize: 11, color: '#888', lineHeight: 1.6 }}>
                                            <span>Started: {new Date(periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            <br />
                                            <span>Next billing: {new Date(periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    )}
                                    {/* Cancel button — only for active Pro */}
                                    {userPlan === 'pro' && !showCancelConfirm && (
                                        <button
                                            className="plan-btn plan-btn-cancel"
                                            onClick={() => { setShowCancelConfirm(true); setCancelMsg(null); }}
                                        >
                                            Cancel Plan
                                        </button>
                                    )}
                                    {showCancelConfirm && (
                                        <div className="cancel-confirm-box">
                                            <p className="cancel-confirm-text">Are you sure? Your plan will be cancelled immediately and you'll be downgraded to Free.</p>
                                            <div className="cancel-confirm-actions">
                                                <button
                                                    className="plan-btn plan-btn-cancel"
                                                    onClick={handleCancelPlan}
                                                    disabled={cancelling}
                                                >
                                                    {cancelling ? 'Cancelling...' : 'Yes, Cancel Plan'}
                                                </button>
                                                <button
                                                    className="plan-btn plan-btn-current"
                                                    onClick={() => setShowCancelConfirm(false)}
                                                    disabled={cancelling}
                                                >
                                                    Go Back
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {cancelMsg && (
                                        <p className={`cancel-status ${cancelMsg.ok ? 'cancel-ok' : 'cancel-err'}`}>{cancelMsg.text}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== CLOUD SYNC TAB ===== */}
                    {activeTab === 'cloud' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Cloud Sync</h2>
                            <p className="panel-desc">Sync your data across devices</p>

                            <div className="settings-card">
                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">
                                            Enable Cloud Sync
                                            {!userIsPro && <span className="pro-badge">Pro</span>}
                                        </h4>
                                        <p className="setting-desc">
                                            Sync dictionary, snippets, notes, and styles to the cloud
                                        </p>
                                    </div>
                                    <button
                                        className={`btn-toggle ${cloudSync ? 'active' : ''} ${!userIsPro ? 'locked' : ''}`}
                                        onClick={handleCloudSync}
                                        disabled={!userIsPro}
                                        title={!userIsPro ? 'Upgrade to Pro to enable Cloud Sync' : ''}
                                    >
                                        <span className="toggle-knob"></span>
                                    </button>
                                </div>
                            </div>

                            {!userIsPro && (
                                <div className="cloud-status cloud-locked">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <span>Cloud Sync is a Pro feature. Upgrade your plan to sync your data across devices.</span>
                                </div>
                            )}

                            {userIsPro && cloudSync && (
                                <div className="cloud-status">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                                        <polyline points="8 16 10 14 12 16 14 14 16 16" />
                                    </svg>
                                    <span>Cloud sync is enabled. Your data will be synced automatically.</span>
                                </div>
                            )}

                            {userIsPro && !cloudSync && (
                                <div className="cloud-status cloud-disabled">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                                    </svg>
                                    <span>Enable cloud sync to back up and access your data from any device.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== ACCOUNT TAB ===== */}
                    {activeTab === 'account' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Account</h2>
                            <p className="panel-desc">Manage your Juskoe account</p>

                            <div className="account-profile-card">
                                <div className="account-avatar">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt={accountName}
                                            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    )}
                                </div>
                                <div className="account-details">
                                    <span className="account-name">{accountName}</span>
                                    <span className="account-email">{accountEmail}</span>
                                </div>
                            </div>

                            <div className="settings-card">
                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Full Name</h4>
                                        <p className="setting-desc">{accountName}</p>
                                    </div>
                                </div>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Email</h4>
                                        <p className="setting-desc">{accountEmail}</p>
                                    </div>
                                </div>

                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Subscription</h4>
                                        <p className="setting-desc">
                                            {userPlan === 'pro'
                                                ? `Pro Plan (${userPlanType === 'pro_annual' ? 'Annual' : 'Monthly'})`
                                                : 'Free Plan'}
                                        </p>
                                        {userPlan === 'pro' && periodStart && periodEnd && (
                                            <div style={{ marginTop: 4, fontSize: 11, color: '#888', lineHeight: 1.6 }}>
                                                <span>Started: {new Date(periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <br />
                                                <span>Next billing: {new Date(periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn-upgrade-sm" onClick={() => setActiveTab('plans')}>
                                        {userPlan === 'pro' ? 'Manage' : 'Upgrade'}
                                    </button>
                                </div>

                                <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                                    <h4 className="setting-title">Usage Today</h4>
                                    <div className="usage-meter-row">
                                        <div className="usage-meter-item">
                                            <div className="usage-meter-header">
                                                <span className="usage-meter-label">AI (F7)</span>
                                                <span className="usage-meter-value">{usageData.dailyAI}{userPlan === 'pro' ? '' : '/10'}</span>
                                            </div>
                                            <div className="usage-progress-bg">
                                                <div
                                                    className="usage-progress-fill ai"
                                                    style={{ width: userPlan === 'pro' ? '100%' : `${Math.min((usageData.dailyAI / 10) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="usage-meter-item">
                                            <div className="usage-meter-header">
                                                <span className="usage-meter-label">Grammar (F8)</span>
                                                <span className="usage-meter-value">{usageData.dailyGrammar}{userPlan === 'pro' ? '' : '/15'}</span>
                                            </div>
                                            <div className="usage-progress-bg">
                                                <div
                                                    className="usage-progress-fill grammar"
                                                    style={{ width: userPlan === 'pro' ? '100%' : `${Math.min((usageData.dailyGrammar / 15) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="usage-meter-item">
                                            <div className="usage-meter-header">
                                                <span className="usage-meter-label">Monthly Total</span>
                                                <span className="usage-meter-value">{usageData.monthlyTotal}{userPlan === 'pro' ? '' : '/200'}</span>
                                            </div>
                                            <div className="usage-progress-bg">
                                                <div
                                                    className="usage-progress-fill monthly"
                                                    style={{ width: userPlan === 'pro' ? '100%' : `${Math.min((usageData.monthlyTotal / 200) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {userPlan === 'pro' && (
                                        <p className="setting-desc" style={{ marginTop: 4, fontSize: 11, opacity: 0.5 }}>Pro plan — unlimited usage</p>
                                    )}
                                </div>
                            </div>

                            <div className="settings-card danger-card">
                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4 className="setting-title">Log out</h4>
                                        <p className="setting-desc">Sign out of your Juskoe account on this device</p>
                                    </div>
                                    <button className="btn-logout" onClick={onLogout}>Log out</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;

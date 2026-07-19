import React, { useState, useEffect } from 'react';
import { RecordingState } from '../App';
import './HomePage.css';

interface HomePageProps {
    recording: RecordingState;
    history: Array<{ time: string; text: string; mode?: string; createdAt: string }>;
    onTriggerVoice: (mode: 'ai' | 'grammar') => void;
    authUser?: any;
    isAuthenticated: boolean;
}

// Truncate text to 3 lines (approx 150 chars)
const truncateText = (text: string, maxLength: number = 180): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
};

const HomePage: React.FC<HomePageProps> = ({ recording, history, authUser, isAuthenticated }) => {
    const [selectedMessage, setSelectedMessage] = useState<{ time: string; text: string } | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [liveAIResult, setLiveAIResult] = useState('');
    const [liveGrammarResult, setLiveGrammarResult] = useState('');
    const [aiConfetti, setAiConfetti] = useState(false);
    const [grammarConfetti, setGrammarConfetti] = useState(false);
    const [copiedToast, setCopiedToast] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showActionCard, setShowActionCard] = useState(true);
    const [aiUsed, setAiUsed] = useState(() => {
        try { const c = localStorage.getItem('juskoe_usage_cache'); if (c) return JSON.parse(c).dailyAI || 0; } catch { } return 0;
    });
    const [grammarUsed, setGrammarUsed] = useState(() => {
        try { const c = localStorage.getItem('juskoe_usage_cache'); if (c) return JSON.parse(c).dailyGrammar || 0; } catch { } return 0;
    });
    const [profile, setProfile] = useState<any>(null);
    const [isPro, setIsPro] = useState(() => {
        try { return localStorage.getItem('juskoe_plan_cache') === 'pro'; } catch { return false; }
    });
    const [localStats, setLocalStats] = useState<any>({ totalWords: 0, avgWpm: 0, streakDays: 0, dailyHistory: [] });

    const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

    // Dynamic greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        const morning = [
            'Good morning, NAME ☀️', 'Rise and shine, NAME!', 'Hope you slept well, NAME',
            'Ready for a great day, NAME?', 'Fresh start — let\'s go, NAME', 'Morning vibes ✨',
            'New day, new goals, NAME', 'Let\'s make today count', 'Up and at it, NAME!',
            'Coffee and code time ☕', 'Beautiful morning, NAME', 'Let\'s crush it today',
        ];
        const afternoon = [
            'Good afternoon, NAME', 'How\'s your day going, NAME?', 'Hope your day is going well',
            'What\'s on your mind, NAME?', 'Afternoon hustle mode', 'Keep the momentum going, NAME',
            'Making progress today?', 'Stay focused, you got this', 'Half the day done 💪',
            'Let\'s keep building, NAME', 'Hey NAME, what\'s next?', 'Still going strong, NAME',
        ];
        const evening = [
            'Good evening, NAME', 'How was your day, NAME?', 'Winding down? Let\'s go, NAME',
            'What\'s new tonight, NAME?', 'Evening session activated', 'Almost there, keep going',
            'Wrapping up the day, NAME?', 'Golden hour vibes 🌅', 'Time for some deep work',
            'Evening productivity mode', 'Relaxing evening, NAME', 'One more push, NAME',
        ];
        const night = [
            'Still going strong, NAME?', 'Burning the midnight oil, NAME?', 'Late night hustle 🌙',
            'Night owl mode activated', 'The world is quiet — create', 'Midnight inspiration, NAME?',
            'Can\'t sleep? Let\'s build', 'Night session unlocked', 'Stars are out, so are you ✨',
            'Late night, big ideas, NAME', 'Quiet hours, NAME', 'Deep focus mode 🌙',
        ];

        let pool: string[];
        if (hour >= 5 && hour < 12) pool = morning;
        else if (hour >= 12 && hour < 17) pool = afternoon;
        else if (hour >= 17 && hour < 21) pool = evening;
        else pool = night;

        return pool[Math.floor(Math.random() * pool.length)];
    };

    const [greeting] = useState(getGreeting);

    // Watch for live results during tutorial
    useEffect(() => {
        if (!showTutorial) return;

        if (recording.result) {
            if (tutorialStep === 1 && recording.mode === 'ai') {
                setLiveAIResult(recording.result);
                setAiConfetti(true);
            } else if (tutorialStep === 3 && recording.mode === 'grammar') {
                setLiveGrammarResult(recording.result);
                setGrammarConfetti(true);
            }
        }
    }, [recording.result, tutorialStep, showTutorial, recording.mode]);

    // Reset tutorial state when opened
    useEffect(() => {
        if (showTutorial) {
            setTutorialStep(0);
            setLiveAIResult('');
            setLiveGrammarResult('');
            setAiConfetti(false);
            setGrammarConfetti(false);
        }
    }, [showTutorial]);

    // Fetch usage, profile, and local stats
    useEffect(() => {
        if (!ipcRenderer) return;
        ipcRenderer.invoke('auth:get-usage').then((data: any) => {
            if (data && typeof data === 'object') {
                const ai = Number(data.dailyAI ?? data.daily_ai ?? 0);
                const grammar = Number(data.dailyGrammar ?? data.daily_grammar ?? 0);
                const monthly = Number(data.monthlyTotal ?? data.monthly_total ?? 0);
                setAiUsed(ai);
                setGrammarUsed(grammar);
                try { localStorage.setItem('juskoe_usage_cache', JSON.stringify({ dailyAI: ai, dailyGrammar: grammar, monthlyTotal: monthly })); } catch { }
            }
        }).catch(() => { });
        ipcRenderer.invoke('auth:get-user').then((p: any) => {
            setProfile(p);
            const pro = p?.plan === 'pro';
            setIsPro(pro);
            try { localStorage.setItem('juskoe_plan_cache', pro ? 'pro' : 'free'); } catch { }
        }).catch(() => { });
        // Fetch local productivity stats
        ipcRenderer.invoke('stats:get').then((stats: any) => {
            if (stats) setLocalStats(stats);
        }).catch(() => { });
    }, [history.length, authUser]);

    // Live stats refresh — triggered after every successful voice command
    useEffect(() => {
        if (!ipcRenderer) return;
        const handleStatsUpdated = (_: any, stats: any) => {
            if (stats) setLocalStats(stats);
        };
        ipcRenderer.on('stats:updated', handleStatsUpdated);
        return () => { ipcRenderer.removeListener('stats:updated', handleStatsUpdated); };
    }, []);

    // Resolve greeting with user's first name
    const userName = profile?.full_name?.split(' ')[0] || authUser?.email?.split('@')[0] || '';
    const resolvedGreeting = greeting.replace(/NAME/g, userName).replace(/, $/, '').replace(/,\s*$/, '');

    // Format time saved into hours/minutes
    const formatTimeSaved = (totalMinutes: number): string => {
        if (totalMinutes < 60) return `${totalMinutes}m`;
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    const handleCopy = async (text: string, idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const clipboard = (window as any).require?.('electron')?.clipboard;
            if (clipboard) {
                clipboard.writeText(text);
            } else {
                await navigator.clipboard.writeText(text);
            }
            setCopiedIndex(idx);
            setCopiedToast(true);
            setTimeout(() => setCopiedIndex(null), 1500);
            setTimeout(() => setCopiedToast(false), 1500);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    // Filter history by search query
    const filteredHistory = React.useMemo(() => {
        if (!searchQuery.trim()) return history;
        const q = searchQuery.toLowerCase();
        return history.filter(item => item.text.toLowerCase().includes(q));
    }, [history, searchQuery]);

    // Bug 2 fix: render history strictly descending by createdAt so the most
    // recent F7/F8/F9 result is always at the top, regardless of how items
    // entered the list (loaded from disk on mount, or appended live via
    // recording:result). App.tsx always populates createdAt (epoch 0 for
    // legacy disk rows without a stored timestamp).
    const sortedHistory = React.useMemo(
        () => [...filteredHistory].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        [filteredHistory]
    );

    // Format date as DD-MMM-YYYY (e.g. "20-Jul-2026")
    const formatDateHeader = (isoString: string): string => {
        const d = new Date(isoString);
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // Group history by date, sorted descending
    const groupedHistory = React.useMemo(() => {
        const groups: Record<string, typeof sortedHistory> = {};
        for (const item of sortedHistory) {
            const dateKey = item.createdAt ? item.createdAt.slice(0, 10) : 'unknown';
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(item);
        }
        // Sort dates descending (latest first)
        return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    }, [sortedHistory]);

    return (
        <div className="home-page fade-in">
            {/* Copied Toast */}
            {copiedToast && (
                <div className="copied-toast">Copied</div>
            )}

            {/* Welcome Header */}
            <div className="welcome-row">
                <div className="welcome-left">
                    <h1 className="page-title">{resolvedGreeting}</h1>
                    <div className="usage-row">
                        <div className="usage-item ai">
                            <span className="usage-label">AI</span>
                            <span className="usage-count">{isPro ? '∞' : String(aiUsed)}</span>
                            <span className="usage-max">/10</span>
                        </div>
                        <div className="usage-item grammar">
                            <span className="usage-label">GRAMMAR</span>
                            <span className="usage-count">{isPro ? '∞' : String(grammarUsed)}</span>
                            <span className="usage-max">/15</span>
                        </div>
                    </div>
                </div>
                <div className="stats-row">
                    {/* Days — red heart */}
                    <span className="stat-item stat-days" title="Consecutive active days">
                        <span className="stat-icon stat-icon-heart">❤️</span>
                        <span className="stat-value">{localStats.streakDays || profile?.streak_days || 0}</span>
                        <span className="stat-label">days</span>
                    </span>
                    {/* Time Saved */}
                    <span className="stat-item stat-saved" title="Typing time saved">
                        <svg className="stat-icon-svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <span className="stat-value">{formatTimeSaved(localStats.totalTimeSavedMinutes || 0)}</span>
                        <span className="stat-label">saved</span>
                    </span>
                    {/* WPM */}
                    <span className="stat-item stat-wpm" title="Average words per minute">
                        <svg className="stat-icon-svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                        <span className="stat-value">{localStats.avgWpm || profile?.avg_wpm || 0}</span>
                        <span className="stat-label">WPM</span>
                    </span>
                    {/* XP */}
                    <span className="stat-item stat-xp" title="Experience & level">
                        <span className="stat-icon stat-icon-xp">⚡</span>
                        <span className="stat-value">{localStats.level || 'Newbie'}</span>
                        <span className="stat-label">{localStats.levelInfo?.progressPercent || 0}%</span>
                    </span>
                </div>
            </div>

            {/* Action Card */}
            {showActionCard && (
                <div className="action-card">
                    <button className="action-card-close" onClick={() => {
                        setShowActionCard(false);
                        if (ipcRenderer) ipcRenderer.invoke('settings:set', 'homeTipDismissed', 'true');
                    }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                    <div className="action-modes-row">
                        <span className="action-mode-chip">
                            <span className="key-text">F7</span>
                            <span className="mode-chip-label">AI Mode</span>
                        </span>
                        <span className="action-mode-chip">
                            <span className="key-text">F8</span>
                            <span className="mode-chip-label">Grammar Mode</span>
                        </span>
                        <span className="action-mode-chip action-mode-rewrite">
                            <span className="tip-selected-text">your text</span>
                            <span className="tip-plus-sign">+</span>
                            <span className="key-text">F7</span>
                            <span className="mode-chip-label">Rewrite</span>
                        </span>
                        <span className="action-mode-chip">
                            <span className="key-text">F9</span>
                            <span className="mode-chip-label">Notes Mode</span>
                        </span>
                    </div>
                    <p className="action-desc">
                        Works in emails, messages, docs — anywhere you type.{' '}
                        <span className="tip-inline-hint">For rewrite: Ctrl+C your text first, then F7.</span>
                    </p>
                    <button className="btn-action" onClick={() => { setShowTutorial(true); setTutorialStep(0); }}>See how it works</button>
                </div>
            )}

            {/* Recording Indicator */}
            {recording.isRecording && (
                <div className="recording-box">
                    <div className="recording-dot"></div>
                    <span>{recording.mode === 'ai' ? 'AI Mode' : 'Grammar Mode'} - Recording...</span>
                </div>
            )}

            {/* Search Bar */}
            <div className="search-bar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="search-icon">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search command history..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="search-clear" onClick={() => setSearchQuery('')}>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>

            {/* History Section */}
            <div className="history-section">
                {groupedHistory.length === 0 ? (
                    <p className="no-history">
                        {searchQuery ? 'No commands match your search.' : 'No commands yet. Press F7, F8 or F9 to start.'}
                    </p>
                ) : (
                    groupedHistory.map(([dateKey, items]) => (
                        <div key={dateKey} className="history-group">
                            <h3 className="history-date">{formatDateHeader(dateKey)}</h3>
                            <div className="history-list">
                                {items.map((item, idx) => {
                                    // Use a composite key so multiple dates don't share hover/copy state
                                    const globalIdx = dateKey + '-' + idx;
                                    return (
                                        <div
                                            key={globalIdx}
                                            className="history-row"
                                            onMouseEnter={() => setHoveredIndex(globalIdx as any)}
                                            onMouseLeave={() => setHoveredIndex(null)}
                                            onClick={() => setSelectedMessage(item)}
                                        >
                                            <span className="history-time">{item.time}</span>
                                            <span className="history-text">{truncateText(item.text)}</span>
                                            {hoveredIndex === globalIdx && (
                                                <button
                                                    className="copy-btn"
                                                    onClick={(e) => handleCopy(item.text, idx, e)}
                                                    title="Copy to clipboard"
                                                >
                                                    {copiedIndex === idx ? (
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" className="tick-animate">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    ) : (
                                                        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                                                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Message Popup Modal */}
            {selectedMessage && (
                <div className="message-modal-overlay" onClick={() => setSelectedMessage(null)}>
                    <div className="message-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="message-modal-header">
                            <span className="message-modal-time">{selectedMessage.time}</span>
                            <button className="message-modal-close" onClick={() => setSelectedMessage(null)}>
                                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <div className="message-modal-body">
                            {selectedMessage.text}
                        </div>
                        <div className="message-modal-footer">
                            <button
                                className="btn-copy-modal"
                                onClick={() => {
                                    navigator.clipboard.writeText(selectedMessage.text);
                                    setCopiedToast(true);
                                    setTimeout(() => setCopiedToast(false), 1500);
                                }}
                            >
                                Copy to Clipboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* How it Works Tutorial */}
            {showTutorial && (
                <div className="message-modal-overlay" onClick={() => setShowTutorial(false)}>
                    <div className="message-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="message-modal-header">
                            <span className="message-modal-time">How it works</span>
                            <button className="message-modal-close" onClick={() => setShowTutorial(false)}>
                                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <div className="message-modal-body" style={{ padding: '20px 24px' }}>
                            {/* Step indicators */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
                                {[0, 1, 2, 3, 4].map(i => (
                                    <div key={i} style={{
                                        height: '3px',
                                        flex: 1,
                                        borderRadius: '2px',
                                        background: i <= tutorialStep ? '#2e2d2d' : '#e0e0e0',
                                        transition: 'background 0.3s ease'
                                    }} />
                                ))}
                            </div>

                            {/* STEP 0: Place cursor for AI mode */}
                            {tutorialStep === 0 && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ background: '#2e2d2d', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>AI MODE</span>
                                        <span style={{ fontSize: '12px', color: '#999' }}>F7</span>
                                    </div>
                                    <h3 style={{ margin: '8px 0 4px', fontSize: '15px', fontWeight: 600 }}>Step 1: Place your cursor</h3>
                                    <p style={{ margin: '0 0 14px', color: '#666', fontSize: '13px' }}>Click on the text box below to place your cursor. This is where Juskoe will paste the live AI response.</p>
                                    <textarea
                                        style={{
                                            width: '100%', height: '90px', padding: '10px 12px', fontSize: '13px',
                                            fontFamily: "'Inter', sans-serif", borderRadius: '6px', resize: 'none',
                                            outline: 'none', background: '#fff', color: '#333', lineHeight: '1.5',
                                            overflowY: 'auto', border: '1px solid #ddd', boxSizing: 'border-box',
                                        }}
                                        placeholder="Click here to place your cursor..."
                                        onFocus={() => setTimeout(() => setTutorialStep(1), 500)}
                                    />
                                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#999' }}>Juskoe will type the response directly into this box.</p>
                                </div>
                            )}

                            {/* STEP 1: Press F7 — Live AI result */}
                            {tutorialStep === 1 && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ background: '#2e2d2d', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>AI MODE</span>
                                        <span style={{ fontSize: '12px', color: '#999' }}>F7</span>
                                    </div>
                                    <h3 style={{ margin: '8px 0 4px', fontSize: '15px', fontWeight: 600 }}>Step 2: Press F7 and ask for a prompt</h3>
                                    <p style={{ margin: '0 0 14px', color: '#666', fontSize: '13px' }}>Press <strong>F7</strong> and say: <em>"i need a prompt to build a to-do app"</em> — then press F7 again.</p>
                                    <textarea
                                        autoFocus
                                        readOnly={!!liveAIResult}
                                        style={{
                                            width: '100%', height: '120px', padding: '10px 12px', fontSize: '13px',
                                            fontFamily: "'Inter', sans-serif", borderRadius: '6px', resize: 'none',
                                            outline: 'none', background: '#fff', color: '#333', lineHeight: '1.5',
                                            overflowY: 'auto', border: '1px solid #2e2d2d', boxSizing: 'border-box',
                                        }}
                                        placeholder="Waiting for your F7 command..."
                                        value={liveAIResult}
                                    />
                                    {liveAIResult && (
                                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#28a745', fontWeight: 500 }}>🎉 Confetti! Juskoe just generated and pasted that live response!</p>
                                    )}
                                    {/* Confetti */}
                                    {aiConfetti && (
                                        <div style={{ position: 'relative', height: '0', overflow: 'visible' }}>
                                            <div className="tutorial-confetti">
                                                {Array.from({ length: 30 }).map((_, i) => (
                                                    <div key={i} className="confetti-piece" style={{
                                                        left: `${Math.random() * 100}%`,
                                                        background: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6', '#845ef7'][i % 6],
                                                        animationDelay: `${Math.random() * 0.5}s`,
                                                        animationDuration: `${1 + Math.random() * 1.5}s`,
                                                    }} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: Place cursor for Grammar mode */}
                            {tutorialStep === 2 && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ background: '#2e2d2d', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>GRAMMAR MODE</span>
                                        <span style={{ fontSize: '12px', color: '#999' }}>F8</span>
                                    </div>
                                    <h3 style={{ margin: '8px 0 4px', fontSize: '15px', fontWeight: 600 }}>Step 3: Place your cursor</h3>
                                    <p style={{ margin: '0 0 14px', color: '#666', fontSize: '13px' }}>Click on the text box below. This time we'll use Grammar mode (F8) to fix something you say.</p>
                                    <textarea
                                        style={{
                                            width: '100%', height: '90px', padding: '10px 12px', fontSize: '13px',
                                            fontFamily: "'Inter', sans-serif", borderRadius: '6px', resize: 'none',
                                            outline: 'none', background: '#fff', color: '#333', lineHeight: '1.5',
                                            overflowY: 'auto', border: '1px solid #ddd', boxSizing: 'border-box',
                                        }}
                                        placeholder="Click here to place your cursor..."
                                        onFocus={() => setTimeout(() => setTutorialStep(3), 500)}
                                    />
                                </div>
                            )}

                            {/* STEP 3: Press F8 — Live Grammar result */}
                            {tutorialStep === 3 && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ background: '#2e2d2d', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>GRAMMAR MODE</span>
                                        <span style={{ fontSize: '12px', color: '#999' }}>F8</span>
                                    </div>
                                    <h3 style={{ margin: '8px 0 4px', fontSize: '15px', fontWeight: 600 }}>Step 4: Press F8 and talk anything</h3>
                                    <p style={{ margin: '0 0 14px', color: '#666', fontSize: '13px' }}>Press <strong>F8</strong>, speak naturally (it's okay to make mistakes), then press F8 again.</p>
                                    <textarea
                                        autoFocus
                                        readOnly={!!liveGrammarResult}
                                        style={{
                                            width: '100%', height: '90px', padding: '10px 12px', fontSize: '13px',
                                            fontFamily: "'Inter', sans-serif", borderRadius: '6px', resize: 'none',
                                            outline: 'none', background: '#fff', color: '#333', lineHeight: '1.5',
                                            overflowY: 'auto', border: '1px solid #2e2d2d', boxSizing: 'border-box',
                                        }}
                                        placeholder="Waiting for your F8 command..."
                                        value={liveGrammarResult}
                                    />
                                    {liveGrammarResult && (
                                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#28a745', fontWeight: 500 }}>🎉 Confetti! Juskoe fixed your grammar and pasted it live!</p>
                                    )}
                                    {/* Confetti */}
                                    {grammarConfetti && (
                                        <div style={{ position: 'relative', height: '0', overflow: 'visible' }}>
                                            <div className="tutorial-confetti">
                                                {Array.from({ length: 30 }).map((_, i) => (
                                                    <div key={i} className="confetti-piece" style={{
                                                        left: `${Math.random() * 100}%`,
                                                        background: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6', '#845ef7'][i % 6],
                                                        animationDelay: `${Math.random() * 0.5}s`,
                                                        animationDuration: `${1 + Math.random() * 1.5}s`,
                                                    }} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 4: Final — use it anywhere */}
                            {tutorialStep === 4 && (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
                                    <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#2e2d2d' }}>You're all set!</h3>
                                    <p style={{ margin: '0 0 16px', color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
                                        Use Juskoe in <strong>any application</strong> — emails, chat, docs, or code. It's now your secret weapon for productivity.
                                    </p>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
                                        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '12px 16px', flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2e2d2d', marginBottom: '4px' }}>F7 — AI Mode</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>Generate anything</div>
                                        </div>
                                        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '12px 16px', flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2e2d2d', marginBottom: '4px' }}>F8 — Grammar</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>Speak naturally</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="message-modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <button
                                className="btn-copy-modal"
                                style={{ opacity: tutorialStep === 0 ? 0.4 : 1, background: 'transparent', color: '#2e2d2d', border: '1px solid #ddd' }}
                                onClick={() => tutorialStep > 0 && setTutorialStep(tutorialStep - 1)}
                            >
                                Back
                            </button>

                            {/* Show Next/Close button only when action is done for steps 1 and 3 */}
                            {tutorialStep === 1 ? (
                                liveAIResult ? (
                                    <button
                                        className="btn-copy-modal fade-in"
                                        style={{ background: '#28a745', animation: 'scaleUp 0.3s ease-out' }}
                                        onClick={() => setTutorialStep(tutorialStep + 1)}
                                    >
                                        Continue
                                    </button>
                                ) : null
                            ) : tutorialStep === 3 ? (
                                liveGrammarResult ? (
                                    <button
                                        className="btn-copy-modal fade-in"
                                        style={{ background: '#28a745', animation: 'scaleUp 0.3s ease-out' }}
                                        onClick={() => setTutorialStep(tutorialStep + 1)}
                                    >
                                        Finish
                                    </button>
                                ) : null
                            ) : (
                                <button
                                    className="btn-copy-modal"
                                    style={tutorialStep === 4 ? { background: '#28a745', color: '#fff', border: 'none', animation: 'scaleUp 0.3s ease-out' } : {}}
                                    onClick={() => {
                                        if (tutorialStep < 4) {
                                            setTutorialStep(tutorialStep + 1);
                                        } else {
                                            setShowTutorial(false);
                                        }
                                    }}
                                >
                                    {tutorialStep === 4 ? 'Close' : 'Next'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;

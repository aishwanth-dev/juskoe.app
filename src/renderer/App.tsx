import React, { useEffect, useState, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Dock from './components/Dock';
import Titlebar from './components/Titlebar';
import SettingsModal from './components/SettingsModal';
import HomePage from './pages/HomePage';
import DictionaryPage from './pages/DictionaryPage';
import SnippetsPage from './pages/SnippetsPage';
import NotesPage from './pages/NotesPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import PricingPage from './pages/PricingPage';
import './styles/global.css';

// Get Electron IPC
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

export interface RecordingState {
    isRecording: boolean;
    mode: 'ai' | 'grammar';
    transcript?: string;
    result?: string;
    error?: string;
}

/**
 * Inner component that handles navigation resets.
 * Must be inside HashRouter to use useNavigate().
 */
function NavigationResetter({ onResetComplete }: { onResetComplete?: () => void }) {
    const navigate = useNavigate();

    useEffect(() => {
        if (!ipcRenderer) return;

        // When the main window is shown (reopen after close), go to home
        const handleWindowShown = () => {
            console.log('[Nav] Window shown — resetting to home');
            navigate('/', { replace: true });
            onResetComplete?.();
        };

        ipcRenderer.on('window:shown', handleWindowShown);

        return () => {
            ipcRenderer.removeAllListeners('window:shown');
        };
    }, [navigate, onResetComplete]);

    return null; // Renders nothing, just manages navigation side effects
}

const App: React.FC = () => {
    const [recording, setRecording] = useState<RecordingState>({
        isRecording: false,
        mode: 'ai',
    });
    const [history, setHistory] = useState<Array<{ time: string; text: string; mode?: string; createdAt: string }>>([]);
    const [showSettings, setShowSettings] = useState(false);

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authUser, setAuthUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Onboarding + Pricing gates (must be declared here, not after conditional returns!)
    const [onboardingDone, setOnboardingDone] = useState(() =>
        localStorage.getItem('juskoe_onboarding_complete') === 'true'
    );
    const [pricingSeen, setPricingSeen] = useState(() =>
        localStorage.getItem('juskoe_pricing_seen') === 'true'
    );

    // Reset navigation to home — call this on login/logout/reopen
    const resetToHome = useCallback(() => {
        // Force hash to "/" — works even outside router context
        window.location.hash = '#/';
        setShowSettings(false);
    }, []);

    // Called when NavigationResetter fires (window shown)
    const handleWindowShownReset = useCallback(() => {
        setShowSettings(false);
    }, []);

    // Audio recording refs — ZERO AudioContext usage to prevent Electron crashes
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const isRecordingRef = useRef(false);

    const startRecording = async (_mode: 'ai' | 'grammar') => {
        if (isRecordingRef.current) return;
        console.log('[Audio] Starting mic...');

        try {
            // Read selected mic from localStorage (set by SettingsModal)
            const selectedMic = localStorage.getItem('juskoe_selectedMic') || '';
            const audioConstraints: MediaTrackConstraints = {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
            };
            if (selectedMic && selectedMic !== 'default') {
                try {
                    audioConstraints.deviceId = { exact: selectedMic };
                } catch {
                    // Invalid deviceId — fall back to default
                }
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            streamRef.current = stream;
            audioChunksRef.current = [];
            isRecordingRef.current = true;

            const mr = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus' : 'audio/webm'
            });
            mediaRecorderRef.current = mr;

            mr.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mr.onstop = async () => {
                // Stop mic track immediately
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;

                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (blob.size < 100) {
                    ipcRenderer?.send('recording:error', 'Recording too short');
                    return;
                }

                // Send raw webm bytes — main process handles conversion to WAV
                const buf = await blob.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                for (let i = 0; i < bytes.length; i += 8192) {
                    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + 8192, bytes.length))));
                }
                const b64 = btoa(binary);
                console.log('[Audio] Sending', (buf.byteLength / 1024).toFixed(1), 'KB webm to main');
                ipcRenderer?.send('audio:blob', { wavBase64: b64 });
            };

            mr.start(200);
            console.log('[Audio] Recording...');
        } catch (err) {
            console.error('[Audio] Mic error:', err);
            ipcRenderer?.send('recording:error', 'Microphone access denied');
        }
    };

    const stopRecording = () => {
        if (!isRecordingRef.current) return;
        isRecordingRef.current = false;
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const cleanup = () => {
        isRecordingRef.current = false;
        try { mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop(); } catch { }
        mediaRecorderRef.current = null;
        try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { }
        streamRef.current = null;
        audioChunksRef.current = [];
    };

    useEffect(() => {
        if (!ipcRenderer) {
            console.log('[App] Running without Electron IPC');
            return;
        }

        // Load persisted history from disk on startup.
        // Carry an authoritative `createdAt` ISO string so the renderer can
        // sort newest-first regardless of disk insertion order. Legacy items
        // without `created_at` get epoch 0 so they sink to the bottom.
        ipcRenderer.invoke('history:get').then((saved: any[]) => {
            if (saved && saved.length > 0) {
                setHistory(saved.map((e: any) => ({
                    time: e.time,
                    text: e.text,
                    mode: e.mode,
                    createdAt: e.created_at || new Date(0).toISOString(),
                })));
            }
        }).catch(() => {});

        ipcRenderer.on('recording:start', (_: any, mode: 'ai' | 'grammar') => {
            console.log('[App] Recording start signal:', mode);
            setRecording({ isRecording: true, mode });
            startRecording(mode);
        });

        ipcRenderer.on('recording:stop', () => {
            console.log('[App] Recording stop signal');
            setRecording((prev) => ({ ...prev, isRecording: false }));
            stopRecording();
        });

        ipcRenderer.on('recording:cancel', () => {
            console.log('[App] Recording cancelled');
            isRecordingRef.current = false;
            cleanup();
            setRecording({ isRecording: false, mode: 'ai' });
        });

        ipcRenderer.on('recording:result', (_: any, data: { success: boolean; text?: string; error?: string; createdAt?: string }) => {
            console.log('[App] Recording result:', data);
            if (data.success && data.text) {
                const now = new Date();
                const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const createdAt = data.createdAt || now.toISOString();
                setHistory((prev) => [{ time, text: data.text!, createdAt }, ...prev.slice(0, 199)]);
                setRecording((prev) => ({ ...prev, result: data.text }));
            } else if (data.error) {
                setRecording((prev) => ({ ...prev, error: data.error }));
            }
        });

        ipcRenderer.send('mic:ready');

        return () => {
            ipcRenderer.removeAllListeners('recording:start');
            ipcRenderer.removeAllListeners('recording:stop');
            ipcRenderer.removeAllListeners('recording:cancel');
            ipcRenderer.removeAllListeners('recording:result');
        };
    }, []);

    // Reload history from disk (used on account switch)
    const reloadHistory = useCallback(() => {
        if (!ipcRenderer) return;
        ipcRenderer.invoke('history:get').then((saved: any[]) => {
            if (saved && saved.length > 0) {
                setHistory(saved.map((e: any) => ({
                    time: e.time,
                    text: e.text,
                    mode: e.mode,
                    createdAt: e.created_at || new Date(0).toISOString(),
                })));
            } else {
                setHistory([]);
            }
        }).catch(() => setHistory([]));
    }, []);

    // Auth listener
    useEffect(() => {
        if (!ipcRenderer) { setAuthLoading(false); return; }

        // Listen for auth state changes
        ipcRenderer.on('auth:state-changed', (_: any, state: any) => {
            setIsAuthenticated(state.isAuthenticated);
            setAuthUser(state.user);
            setAuthLoading(false);
            if (state.isAuthenticated) {
                // Reload history for the newly logged-in account
                reloadHistory();
                // Reset to home on login
                resetToHome();
            } else {
                // On logout, clear history so old account data doesn't leak
                setHistory([]);
                reloadHistory();
            }
        });

        // Request initial auth state
        ipcRenderer.invoke('auth:get-user').then((user: any) => {
            if (user) {
                setIsAuthenticated(true);
                setAuthUser(user);
            }
            setAuthLoading(false);
        }).catch(() => setAuthLoading(false));

        return () => {
            ipcRenderer.removeAllListeners('auth:state-changed');
        };
    }, [resetToHome]);

    const triggerVoice = (mode: 'ai' | 'grammar') => {
        ipcRenderer?.send('voice:trigger', mode);
    };

    const handleLogout = async () => {
        // Close settings modal first
        setShowSettings(false);
        // Sign out
        await ipcRenderer?.invoke('auth:logout');
        // Clear all cached state
        setIsAuthenticated(false);
        setAuthUser(null);
        setHistory([]);
        // Clear localStorage flags so login/pricing show again
        localStorage.removeItem('juskoe_pricing_seen');
        localStorage.removeItem('juskoe_plan_cache');
        localStorage.removeItem('juskoe_usage_cache');
    };

    // --- Gate: Onboarding ---
    const handleOnboardingComplete = () => {
        localStorage.setItem('juskoe_onboarding_complete', 'true');
        setOnboardingDone(true);
    };

    if (!onboardingDone) {
        return <OnboardingPage onComplete={handleOnboardingComplete} />;
    }

    // --- Gate: Login (mandatory) ---
    if (!authLoading && !isAuthenticated) {
        return <LoginPage />;
    }

    // --- Gate: Pricing (show once per login, skip for Pro users) ---
    const handlePricingContinue = () => {
        localStorage.setItem('juskoe_pricing_seen', 'true');
        setPricingSeen(true);
    };

    const userIsPro = authUser?.plan === 'pro';
    if (!pricingSeen && !userIsPro) {
        return <PricingPage onContinue={handlePricingContinue} />;
    }

    return (
        <HashRouter>
            {/* Invisible component that handles nav resets from IPC events */}
            <NavigationResetter onResetComplete={handleWindowShownReset} />

            <div className="app-wrapper">
                {/* Background Layer 1: Soft color glow */}
                <div className="bg-glow" />
                {/* Background Layer 2: Tile grid */}
                <div className="bg-tiles" />

                {/* Titlebar at the very top spanning full width */}
                <Titlebar />

                {/* Below titlebar: content area + dock */}
                <div className="app-body">
                    <main className="main-content">
                        <div className="page-container">
                            <Routes>
                                <Route
                                    path="/"
                                    element={
                                        <HomePage
                                            recording={recording}
                                            history={history}
                                            onTriggerVoice={triggerVoice}
                                            authUser={authUser}
                                            isAuthenticated={isAuthenticated}
                                        />
                                    }
                                />
                                <Route path="/dictionary" element={<DictionaryPage />} />
                                <Route path="/snippets" element={<SnippetsPage />} />
                                <Route path="/notes" element={<NotesPage />} />
                            </Routes>
                        </div>
                    </main>
                    <Dock onOpenSettings={() => setShowSettings(true)} />
                </div>

                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    authUser={authUser}
                    isAuthenticated={isAuthenticated}
                    onLogout={handleLogout}
                />
            </div>
        </HashRouter>
    );
};

export default App;

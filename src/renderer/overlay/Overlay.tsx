import React, { useEffect, useState } from 'react';
import './Overlay.css';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

type OverlayState = 'low-idle' | 'listening' | 'processing' | 'complete' | 'error';

// Aesthetic error messages — categorized by error type
const ERROR_VOICE = [
    "hmm, didn't catch that",
    "too quiet for me",
    "say that again?",
    "your voice ghosted me",
    "silence isn't a prompt",
    "the mic's being shy",
    "try a lil closer?",
    "that was all noise, sorry",
    "couldn't make that out",
    "the air ate your words",
];

const ERROR_NETWORK = [
    "is the wifi workin'?",
    "the connection dipped",
    "the signal faded out",
    "network hiccup, try again",
    "check the connection maybe?",
    "lost in the airwaves",
    "the signal broke up",
];

const ERROR_CREDITS = [
    "outta juice for now",
    "energy's all used up",
    "no more credits today",
    "you're tapped out",
    "limit hit, recharge tmrw",
    "that's a wrap for today",
];

const ERROR_BAD_RESPONSE = [
    "the AI got meta, try again",
    "it analyzed instead of writing",
    "that came out wrong",
    "got an explanation, not output",
    "AI thought about it too much",
    "try phrasing it differently",
    "AI had a moment",
];

const ERROR_GENERIC = [
    "something's off, try again",
    "nope, got nothing",
    "that came through empty",
    "words got lost somewhere",
    "audio took a wrong turn",
];

const Overlay: React.FC = () => {
    const [state, setState] = useState<OverlayState>('low-idle');
    const [mode, setMode] = useState<'ai' | 'grammar' | 'notes'>('ai');
    const [idleVisible, setIdleVisible] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        console.log('[Overlay] Component mounted');

        if (ipcRenderer) {
            ipcRenderer.on('state', (_: any, newState: string) => {
                console.log('[Overlay] State change:', newState);

                if (newState === 'error') {
                    // Use pending error text if set, else pick random from generic
                    if (!pendingErrorText) {
                        const msg = ERROR_GENERIC[Math.floor(Math.random() * ERROR_GENERIC.length)];
                        setErrorMsg(msg);
                    }
                    pendingErrorText = null;
                    setState('error');
                    setTimeout(() => setState('low-idle'), 3000);
                } else if (newState === 'idle' || newState === 'success') {
                    setState('complete');
                    setTimeout(() => setState('low-idle'), 3000);
                } else if (newState === 'listening') {
                    setState('listening');
                } else if (newState === 'processing') {
                    setState('processing');
                }
            });

            // Receive specific error category from main process
            let pendingErrorText: string | null = null;
            ipcRenderer.on('overlay:error-category', (_: any, category: string) => {
                let pool = ERROR_GENERIC;
                if (category === 'credits') pool = ERROR_CREDITS;
                else if (category === 'voice') pool = ERROR_VOICE;
                else if (category === 'network') pool = ERROR_NETWORK;
                else if (category === 'bad_response') pool = ERROR_BAD_RESPONSE;
                const msg = pool[Math.floor(Math.random() * pool.length)];
                setErrorMsg(msg);
                pendingErrorText = msg;
            });

            // Receive custom AI-generated error message (overrides the pool pick)
            ipcRenderer.on('overlay:error-message', (_: any, message: string) => {
                if (message && message.trim()) {
                    setErrorMsg(message.trim());
                    pendingErrorText = message.trim();
                }
            });

            ipcRenderer.on('overlay:mode', (_: any, newMode: 'ai' | 'grammar' | 'notes') => {
                console.log('[Overlay] Mode change:', newMode);
                setMode(newMode);
            });

            ipcRenderer.on('overlay:idleVisible', (_: any, visible: boolean) => {
                console.log('[Overlay] Idle visible:', visible);
                setIdleVisible(visible);
            });
        }

        setState('low-idle');

        return () => {
            if (ipcRenderer) {
                ipcRenderer.removeAllListeners('state');
                ipcRenderer.removeAllListeners('overlay:mode');
                ipcRenderer.removeAllListeners('overlay:idleVisible');
                ipcRenderer.removeAllListeners('overlay:error-category');
            }
        };
    }, []);

    // Build equalizer bars
    const bars = Array.from({ length: 5 }, (_, i) => {
        const delay = i * 0.12;
        return (
            <div
                key={i}
                className="wave-bar active"
                style={{ animationDelay: `${delay}s` }}
            />
        );
    });

    // Determine pill class
    const isExpanded = state === 'listening' || state === 'processing' || state === 'complete';
    const isError = state === 'error';
    const pillClass = isError ? 'error-pill' : isExpanded ? 'expanded' : 'low-idle';

    // Hide completely when in low-idle and user disabled idle pill
    if (state === 'low-idle' && !idleVisible) {
        return <div className="overlay-container low-idle" />;
    }

    return (
        <div className={`overlay-container ${state}`}>
            <div className={`overlay-pill ${pillClass}`}>
                {/* Error state */}
                {isError && (
                    <>
                        <span className="error-dot" />
                        <span className="error-label">{errorMsg}</span>
                    </>
                )}

                {/* Listening: AI/G + equalizer */}
                {state === 'listening' && (
                    <>
                        <span className="mode-label">{mode === 'ai' ? 'AI' : mode === 'notes' ? 'N' : 'G'}</span>
                        <div className="waveform">
                            {bars}
                        </div>
                    </>
                )}

                {/* Processing: equalizer */}
                {state === 'processing' && (
                    <div className="waveform processing">
                        {bars}
                    </div>
                )}

                {/* Complete: brand text */}
                {state === 'complete' && (
                    <span className="brand-label">juskoe</span>
                )}
            </div>
        </div>
    );
};

export default Overlay;

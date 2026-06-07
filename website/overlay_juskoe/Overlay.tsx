import React, { useEffect, useState } from 'react';
import './Overlay.css';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

type OverlayState = 'low-idle' | 'listening' | 'processing' | 'complete' | 'error';

// 27 aesthetic error messages — indirect, personality-driven
const ERROR_MESSAGES = [
    "hmm, didn't catch that",
    "is the mic on?",
    "that was just static",
    "say that again?",
    "words got lost somewhere",
    "is the wifi workin'?",
    "too quiet for me",
    "the signal faded out",
    "try a lil closer?",
    "your voice ghosted me",
    "nope, got nothing",
    "the connection dipped",
    "is the internet vibin'?",
    "lost in the airwaves",
    "that came through empty",
    "audio took a wrong turn",
    "couldn't make that out",
    "the signal broke up",
    "check the connection maybe?",
    "something's off, try again",
    "the mic's being shy",
    "silence isn't a prompt",
    "that was all noise, sorry",
    "network hiccup, try again",
    "your words didn't land",
    "is the mic plugged in?",
    "the air ate your words",
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
                    // Pick a random error message
                    const msg = ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)];
                    setErrorMsg(msg);
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

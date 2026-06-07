// ============================================
// Web Speech API - Free, Real-time STT
// Built into Chromium/Electron - No API key needed!
// Latency: ~200-500ms (streaming)
// ============================================

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    length: number;
    isFinal: boolean;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onstart: ((ev: Event) => void) | null;
    onresult: ((ev: SpeechRecognitionEvent) => void) | null;
    onerror: ((ev: Event & { error: string }) => void) | null;
    onend: ((ev: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export type SpeechCallback = (transcript: string, isFinal: boolean) => void;
export type ErrorCallback = (error: string) => void;

class SpeechRecognizer {
    private recognition: SpeechRecognition | null = null;
    private isListening = false;
    private finalTranscript = '';
    private onResult: SpeechCallback | null = null;
    private onError: ErrorCallback | null = null;

    constructor() {
        this.initRecognition();
    }

    private initRecognition(): void {
        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognitionClass) {
            console.error('[Speech] Web Speech API not supported');
            return;
        }

        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            console.log('[Speech] Recognition started');
            this.isListening = true;
            this.finalTranscript = '';
        };

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    this.finalTranscript += result[0].transcript + ' ';
                    console.log('[Speech] Final:', result[0].transcript);
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            // Send callback with current transcript
            const currentTranscript = (this.finalTranscript + interimTranscript).trim();
            const isFinal = event.results[event.results.length - 1]?.isFinal || false;

            this.onResult?.(currentTranscript, isFinal);
        };

        this.recognition.onerror = (event) => {
            console.error('[Speech] Error:', event.error);
            this.onError?.(event.error);
            this.isListening = false;
        };

        this.recognition.onend = () => {
            console.log('[Speech] Recognition ended');
            this.isListening = false;
        };
    }

    start(onResult: SpeechCallback, onError?: ErrorCallback): void {
        if (!this.recognition) {
            onError?.('Speech recognition not available');
            return;
        }

        if (this.isListening) {
            console.log('[Speech] Already listening');
            return;
        }

        this.onResult = onResult;
        this.onError = onError || null;
        this.finalTranscript = '';

        try {
            this.recognition.start();
        } catch (error) {
            console.error('[Speech] Start error:', error);
            this.onError?.('Failed to start recognition');
        }
    }

    stop(): string {
        if (!this.recognition || !this.isListening) {
            return this.finalTranscript.trim();
        }

        this.recognition.stop();
        this.isListening = false;

        return this.finalTranscript.trim();
    }

    abort(): void {
        if (this.recognition) {
            this.recognition.abort();
            this.isListening = false;
        }
    }

    isActive(): boolean {
        return this.isListening;
    }

    getTranscript(): string {
        return this.finalTranscript.trim();
    }
}

// Singleton instance
let recognizerInstance: SpeechRecognizer | null = null;

export function getSpeechRecognizer(): SpeechRecognizer {
    if (!recognizerInstance) {
        recognizerInstance = new SpeechRecognizer();
    }
    return recognizerInstance;
}

export { SpeechRecognizer };

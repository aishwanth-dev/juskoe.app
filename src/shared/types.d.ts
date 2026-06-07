export type CommandMode = 'ai' | 'grammar';
export type IntentType = 'write' | 'rewrite' | 'grammar' | 'save_note' | 'send_email' | 'insert_snippet';
export interface VoiceRequest {
    audio?: ArrayBuffer;
    transcript?: string;
    mode: CommandMode;
    selectedText?: string;
    role?: string;
}
export interface VoiceResponse {
    success: boolean;
    transcript: string;
    intent: IntentType;
    processedText: string;
    action?: ActionPayload;
    latencyMs: number;
    error?: string;
}
export interface ActionPayload {
    type: IntentType;
    target?: string;
    content: string;
    metadata?: Record<string, unknown>;
}
export interface User {
    id: string;
    email: string;
    plan: 'free' | 'pro' | 'enterprise';
    created_at: string;
}
export interface Note {
    id: string;
    user_id: string;
    text: string;
    tags: string[];
    created_at: string;
}
export interface Snippet {
    id: string;
    user_id: string;
    key: string;
    value: string;
}
export interface Role {
    id: string;
    user_id: string;
    name: string;
    prompt: string;
}
export interface LogEntry {
    id: string;
    user_id: string;
    action: string;
    latency_ms: number;
    created_at: string;
}
export type OverlayState = 'hidden' | 'listening' | 'processing' | 'success' | 'error';
export interface IPCEvents {
    'hotkey:ai-mode': void;
    'hotkey:grammar-mode': void;
    'audio:start': void;
    'audio:stop': void;
    'audio:data': ArrayBuffer;
    'voice:process': VoiceRequest;
    'voice:result': VoiceResponse;
    'overlay:show': OverlayState;
    'overlay:hide': void;
    'inject:text': string;
    'selection:get': void;
    'selection:result': string;
}
export interface UserStats {
    weeklyStreak: number;
    averageWPM: number;
    totalWords: number;
    todayWords: number;
}
//# sourceMappingURL=types.d.ts.map
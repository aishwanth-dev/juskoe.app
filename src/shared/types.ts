// ============================================
// JUSKOE — Type Definitions
// ============================================

// ---- Plans ----
export type PlanType = 'free' | 'pro';

// ---- Auth ----
export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    plan: PlanType;
    daily_ai_used: number;
    daily_grammar_used: number;
    monthly_used: number;
    last_usage_reset: string;     // ISO date for daily reset
    last_monthly_reset: string;   // ISO date for monthly reset
    created_at: string;
    updated_at: string;
    // Subscription info (enriched by auth:get-user)
    planType?: 'pro_monthly' | 'pro_annual';
    periodStart?: string | null;
    periodEnd?: string | null;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: UserProfile | null;
    loading: boolean;
}

// ---- Subscription ----
export interface Subscription {
    id: string;
    user_id: string;
    plan: PlanType;
    status: 'active' | 'cancelled' | 'past_due' | 'trialing';
    razorpay_subscription_id: string | null;
    current_period_start: string;
    current_period_end: string;
    created_at: string;
}

// ---- Cloud Data ----
export interface CloudDictionary {
    id: string;
    user_id: string;
    word: string;
    correction: string;
    created_at: string;
}

export interface CloudSnippet {
    id: string;
    user_id: string;
    key: string;
    title: string;
    content: string;
    category: string;
    created_at: string;
}

export interface CloudNote {
    id: string;
    user_id: string;
    text: string;
    tags: string[];
    created_at: string;
}

// ---- Usage Log ----
export interface UsageLog {
    id: string;
    user_id: string;
    mode: 'ai' | 'grammar' | 'notes';
    created_at: string;
}

// ---- Usage Summary ----
export interface UsageSummary {
    dailyAI: number;
    dailyGrammar: number;
    monthlyTotal: number;
    limitReached: boolean;
}

// ---- Voice Command Modes ----
export type CommandMode = 'ai' | 'grammar';

// ---- Intent Types ----
export type IntentType =
    | 'write'
    | 'rewrite'
    | 'grammar'
    | 'save_note'
    | 'send_email'
    | 'insert_snippet';

// ---- AI Pipeline ----
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

// ---- Overlay ----
export type OverlayState =
    | 'hidden'
    | 'listening'
    | 'processing'
    | 'success'
    | 'error';

// ---- IPC Channels ----
export interface IPCChannels {
    // Auth
    'auth:login-email': { email: string };
    'auth:verify-otp': { email: string; token: string };
    'auth:login-google': void;
    'auth:logout': void;
    'auth:get-user': void;
    'auth:state-changed': AuthState;
    'auth:get-usage': void;
    'auth:usage': UsageSummary;
    // Existing
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

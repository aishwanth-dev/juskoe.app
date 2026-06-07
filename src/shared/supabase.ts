// ============================================
// JUSKOE — Supabase Client
// Full auth, cloud CRUD, usage tracking
// ============================================

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import {
    UserProfile,
    CloudDictionary,
    CloudSnippet,
    CloudNote,
    UsageSummary,
    Subscription,
} from './types';

// Initialize Supabase client
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,  // Electron doesn't use URL-based auth
    },
});

// ============================================
// Authentication
// ============================================

/** Send OTP code to email */
export async function sendOTP(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
    });
    if (error) throw error;
}

/** Verify OTP code */
export async function verifyOTP(email: string, token: string): Promise<Session> {
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    });
    if (error) throw error;
    if (!data.session) throw new Error('No session returned');
    return data.session;
}

/** Sign up with email + password + name */
export async function signUpWithPassword(email: string, password: string, name?: string): Promise<{ session: Session | null; needsVerification: boolean }> {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name || email.split('@')[0] },
        },
    });
    if (error) throw error;
    // If session is null, user needs to verify email (Supabase sends confirmation)
    // If session exists, auto-confirm is on and user is logged in
    return {
        session: data.session,
        needsVerification: !data.session,
    };
}

/** Sign in with email + password */
export async function signInWithPassword(email: string, password: string): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    if (!data.session) throw new Error('No session returned');
    return data.session;
}

/** Google OAuth — returns URL to open in browser */
export async function getGoogleOAuthURL(redirectTo: string): Promise<string> {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            skipBrowserRedirect: true, // We handle the redirect in Electron
        },
    });
    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');
    return data.url;
}

/** Set session from OAuth callback tokens */
export async function setSessionFromTokens(accessToken: string, refreshToken: string): Promise<Session> {
    const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
    if (error) throw error;
    if (!data.session) throw new Error('Failed to set session');
    return data.session;
}

/** Sign out */
export async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/** Get current session */
export async function getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

/** Refresh session to get a fresh access token */
export async function refreshSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
        console.error('[Supabase] refreshSession error:', error.message);
        return null;
    }
    return data.session;
}

/** Get current user's profile */
export async function getProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('[Supabase] getProfile error:', error.message);
        return null;
    }
    return data;
}

/** Check if an email is already used by another account */
export async function checkEmailDuplicate(email: string, currentId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .neq('id', currentId)
        .maybeSingle();

    if (error) {
        console.error('[Supabase] checkEmailDuplicate error:', error.message);
        return false;
    }
    return !!data;
}

/** Update profile fields */
export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();

    if (error) {
        console.error('[Supabase] updateProfile error:', error.message);
        return null;
    }
    return data;
}

// ============================================
// Usage Tracking (Server-side functions)
// ============================================

/** Check and increment usage. Returns whether the action is allowed. */
export async function checkAndIncrementUsage(mode: 'ai' | 'grammar' | 'notes'): Promise<{
    allowed: boolean;
    reason?: string;
    plan: string;
}> {
    try {
        // Race against a 3s timeout — never block the pipeline
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Supabase usage check timed out (3s)')), 3000)
        );
        const rpcCall = supabase.rpc('increment_usage', { p_mode: mode });
        const { data, error } = await Promise.race([rpcCall, timeout.then(() => { throw new Error('timeout'); })]);
        if (error) {
            console.error('[Supabase] increment_usage error:', error.message);
            return { allowed: true, plan: 'free' };
        }
        return data;
    } catch (e: any) {
        console.warn('[Supabase] increment_usage failed (fail-open):', e?.message || e);
        return { allowed: true, plan: 'free' };
    }
}

/** Get usage summary */
export async function getUsageSummary(): Promise<UsageSummary> {
    const { data, error } = await supabase.rpc('get_usage_summary');
    if (error) {
        console.error('[Supabase] get_usage_summary error:', error.message);
        return { dailyAI: 0, dailyGrammar: 0, monthlyTotal: 0, limitReached: false };
    }
    // Normalize: Postgres may return snake_case or camelCase
    const d = data || {};
    return {
        dailyAI: d.dailyAI ?? d.daily_ai ?? 0,
        dailyGrammar: d.dailyGrammar ?? d.daily_grammar ?? 0,
        monthlyTotal: d.monthlyTotal ?? d.monthly_total ?? 0,
        limitReached: d.limitReached ?? d.limit_reached ?? false,
    };
}

/** Update productivity metrics (WPM, Words, Streaks) */
export async function updateProductivityMetrics(updates: {
    words_added?: number;
    wpm?: number;
}): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch current profile stats
    const { data: profile } = await supabase
        .from('profiles')
        .select('total_words, avg_wpm, streak_days, last_active')
        .eq('id', user.id)
        .single();

    if (!profile) return;

    const new_total_words = (profile.total_words || 0) + (updates.words_added || 0);
    let new_avg_wpm = profile.avg_wpm || 0;
    if (updates.wpm) {
        // Weighted average for smoothing
        new_avg_wpm = profile.avg_wpm === 0 ? updates.wpm : Math.round((profile.avg_wpm * 0.7) + (updates.wpm * 0.3));
    }

    // Streak logic
    let new_streak = profile.streak_days || 0;
    const lastActive = profile.last_active ? new Date(profile.last_active) : null;
    const now = new Date();

    if (lastActive) {
        const diffInDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        if (diffInDays === 1) {
            new_streak += 1;
        } else if (diffInDays > 1) {
            new_streak = 1; // Reset if missed a day
        }
    } else {
        new_streak = 1;
    }

    await supabase.from('profiles').update({
        total_words: new_total_words,
        avg_wpm: new_avg_wpm,
        streak_days: new_streak,
        last_active: now.toISOString(),
        updated_at: now.toISOString(),
    }).eq('id', user.id);
}

// ============================================
// Cloud Dictionary
// ============================================

export async function getCloudDictionary(): Promise<CloudDictionary[]> {
    const { data, error } = await supabase
        .from('cloud_dictionary')
        .select('*')
        .order('word');
    if (error) throw error;
    return data || [];
}

export async function upsertCloudDictionaryWord(word: string, correction: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('cloud_dictionary')
        .upsert({ user_id: user.id, word: word.toLowerCase(), correction }, { onConflict: 'user_id,word' });
    if (error) console.error('[Supabase] upsertDictWord:', error.message);
}

export async function deleteCloudDictionaryWord(id: string): Promise<void> {
    const { error } = await supabase.from('cloud_dictionary').delete().eq('id', id);
    if (error) console.error('[Supabase] deleteDictWord:', error.message);
}

// ============================================
// Cloud Snippets
// ============================================

export async function getCloudSnippets(): Promise<CloudSnippet[]> {
    const { data, error } = await supabase
        .from('cloud_snippets')
        .select('*')
        .order('key');
    if (error) throw error;
    return data || [];
}

export async function upsertCloudSnippet(
    key: string, title: string, content: string, category: string = 'general'
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('cloud_snippets')
        .upsert(
            { user_id: user.id, key: key.toLowerCase(), title, content, category },
            { onConflict: 'user_id,key' }
        );
    if (error) console.error('[Supabase] upsertSnippet:', error.message);
}

export async function deleteCloudSnippet(id: string): Promise<void> {
    const { error } = await supabase.from('cloud_snippets').delete().eq('id', id);
    if (error) console.error('[Supabase] deleteSnippet:', error.message);
}

// ============================================
// Cloud Notes
// ============================================

export async function getCloudNotes(): Promise<CloudNote[]> {
    const { data, error } = await supabase
        .from('cloud_notes')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function addCloudNote(text: string, tags: string[] = []): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('cloud_notes')
        .insert({ user_id: user.id, text, tags });
    if (error) console.error('[Supabase] addNote:', error.message);
}

export async function deleteCloudNote(id: string): Promise<void> {
    const { error } = await supabase.from('cloud_notes').delete().eq('id', id);
    if (error) console.error('[Supabase] deleteNote:', error.message);
}

// ============================================
// Subscription
// ============================================

export async function getSubscription(): Promise<Subscription | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

    if (error) return null;
    return data;
}

// ============================================
// Listen for auth state changes
// ============================================

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

// ============================================
// Realtime Cloud Sync — event-driven, no polling
// ============================================

let realtimeChannel: any = null;

export interface CloudChangeCallbacks {
    onDictionaryChange: () => void;
    onSnippetChange: () => void;
    onNoteChange: () => void;
}

/**
 * Subscribe to realtime changes on cloud tables.
 * When another device (e.g., mobile) adds/updates/deletes data,
 * the callback fires so we can sync that change into local storage.
 */
export function subscribeToCloudChanges(callbacks: CloudChangeCallbacks): void {
    // Clean up existing subscription
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    realtimeChannel = supabase
        .channel('cloud-sync')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'cloud_dictionary',
        }, () => {
            console.log('[Realtime] cloud_dictionary changed');
            callbacks.onDictionaryChange();
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'cloud_snippets',
        }, () => {
            console.log('[Realtime] cloud_snippets changed');
            callbacks.onSnippetChange();
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'cloud_notes',
        }, () => {
            console.log('[Realtime] cloud_notes changed');
            callbacks.onNoteChange();
        })
        .subscribe((status: string) => {
            console.log(`[Realtime] Subscription status: ${status}`);
        });
}

/** Unsubscribe from realtime changes (e.g., when cloudSync is turned off) */
export function unsubscribeFromCloudChanges(): void {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
        console.log('[Realtime] Unsubscribed from cloud sync');
    }
}

// Export client for direct access
export { supabase };

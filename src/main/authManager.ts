// ============================================
// JUSKOE — Auth Manager (Main Process)
// Handles login/logout, session persistence,
// Google OAuth via browser, and auth state IPC
// ============================================

import { BrowserWindow, ipcMain, shell } from 'electron';
import {
    sendOTP,
    verifyOTP,
    signUpWithPassword,
    signInWithPassword,
    getGoogleOAuthURL,
    setSessionFromTokens,
    signOut,
    getProfile,
    getSession,
    getUsageSummary,
    onAuthStateChange,
    updateProductivityMetrics,
    checkEmailDuplicate,
} from '../shared/supabase';
import { AuthState, UserProfile, UsageSummary } from '../shared/types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/config';

let mainWindow: BrowserWindow | null = null;
let cachedProfile: UserProfile | null = null;
let cachedUsage: UsageSummary | null = null;

// ============================================
// Initialization
// ============================================

export function initAuth(win: BrowserWindow): void {
    mainWindow = win;

    // Listen for auth state changes from Supabase
    onAuthStateChange(async (event, session) => {
        console.log(`[Auth] State change: ${event}`);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            cachedProfile = await getProfile();
            cachedUsage = await getUsageSummary();
            broadcastAuthState();
        } else if (event === 'SIGNED_OUT') {
            cachedProfile = null;
            cachedUsage = null;
            broadcastAuthState();
        }
    });

    // Register IPC handlers
    registerIPCHandlers();

    // Check existing session on startup
    checkExistingSession();
}

// ============================================
// Session Check
// ============================================

async function checkExistingSession(): Promise<void> {
    try {
        const session = await getSession();
        if (session) {
            console.log('[Auth] Existing session found');
            cachedProfile = await getProfile();
            cachedUsage = await getUsageSummary();
            broadcastAuthState();
        } else {
            console.log('[Auth] No existing session');
            broadcastAuthState();
        }
    } catch (e) {
        console.error('[Auth] Session check error:', e);
        broadcastAuthState();
    }
}

// ============================================
// Broadcast Auth State to Renderer
// ============================================

function broadcastAuthState(): void {
    const state: AuthState = {
        isAuthenticated: !!cachedProfile,
        user: cachedProfile,
        loading: false,
    };
    safeSend('auth:state-changed', state);
}

function safeSend(channel: string, data: any): void {
    try {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
            mainWindow.webContents.send(channel, data);
        }
    } catch (e) {
        // Window might be closed
    }
}

// ============================================
// Profile Polling (after payment)
// ============================================

let pollingTimer: ReturnType<typeof setInterval> | null = null;

function startProfilePolling(): void {
    // Stop any existing polling
    if (pollingTimer) clearInterval(pollingTimer);

    const startTime = Date.now();
    const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes max
    const POLL_INTERVAL = 5000; // every 5 seconds

    console.log('[Auth] Starting profile polling (waiting for plan upgrade)...');

    pollingTimer = setInterval(async () => {
        try {
            // Stop polling after 5 minutes
            if (Date.now() - startTime > MAX_POLL_TIME) {
                console.log('[Auth] Profile polling timed out');
                if (pollingTimer) clearInterval(pollingTimer);
                pollingTimer = null;
                return;
            }

            const freshProfile = await getProfile();
            if (freshProfile && freshProfile.plan !== cachedProfile?.plan) {
                console.log(`[Auth] Plan changed: ${cachedProfile?.plan} → ${freshProfile.plan}`);
                cachedProfile = freshProfile;
                cachedUsage = await getUsageSummary();
                broadcastAuthState();

                // Stop polling — change detected
                if (pollingTimer) clearInterval(pollingTimer);
                pollingTimer = null;
            }
        } catch (e) {
            // Continue polling even if a single check fails
        }
    }, POLL_INTERVAL);
}

// ============================================
// IPC Handlers
// ============================================

function registerIPCHandlers(): void {
    // Email OTP: Step 1 — Send code
    ipcMain.handle('auth:login-email', async (_, email: string) => {
        try {
            console.log(`[Auth] Sending OTP to ${email}`);
            await sendOTP(email);
            return { success: true };
        } catch (error: any) {
            console.error('[Auth] OTP send error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Email OTP: Step 2 — Verify code
    ipcMain.handle('auth:verify-otp', async (_, { email, token }: { email: string; token: string }) => {
        try {
            console.log(`[Auth] Verifying OTP for ${email}`);
            const session = await verifyOTP(email, token);
            cachedProfile = await getProfile();
            cachedUsage = await getUsageSummary();
            broadcastAuthState();
            return { success: true, session };
        } catch (error: any) {
            console.error('[Auth] OTP verify error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Email + Password: Sign Up (with name) — sends verification email
    ipcMain.handle('auth:signup', async (_, { email, password, name }: { email: string; password: string; name?: string }) => {
        try {
            console.log(`[Auth] Signing up ${email} (name: ${name || 'not provided'})`);
            const result = await signUpWithPassword(email, password, name);
            console.log(`[Auth] Signup result: session=${!!result.session}, needsVerification=${result.needsVerification}`);
            if (result.session) {
                // Auto-confirmed — set profile and broadcast
                cachedProfile = await getProfile();
                cachedUsage = await getUsageSummary();
                broadcastAuthState();
            }
            return { success: true, needsVerification: result.needsVerification };
        } catch (error: any) {
            console.error('[Auth] Signup error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Email + Password: Sign In — direct password authentication
    ipcMain.handle('auth:signin', async (_, { email, password }: { email: string; password: string }) => {
        try {
            console.log(`[Auth] Signing in ${email} with password`);
            const session = await signInWithPassword(email, password);
            console.log(`[Auth] Sign-in successful for ${email}`);
            cachedProfile = await getProfile();
            cachedUsage = await getUsageSummary();
            broadcastAuthState();
            return { success: true };
        } catch (error: any) {
            console.error('[Auth] Signin error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Google OAuth — open in user's default browser
    ipcMain.handle('auth:login-google', async () => {
        try {
            openOAuthInBrowser();
            return { success: true };
        } catch (error: any) {
            console.error('[Auth] Google OAuth error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Set session from OAuth callback
    ipcMain.handle('auth:set-session', async (_, { accessToken, refreshToken }: { accessToken: string; refreshToken: string }) => {
        try {
            await setSessionFromTokens(accessToken, refreshToken);
            cachedProfile = await getProfile();
            cachedUsage = await getUsageSummary();
            broadcastAuthState();
            return { success: true };
        } catch (error: any) {
            console.error('[Auth] Set session error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Logout
    ipcMain.handle('auth:logout', async () => {
        try {
            await signOut();
            cachedProfile = null;
            cachedUsage = null;
            broadcastAuthState();
            console.log('[Auth] Logged out');
            return { success: true };
        } catch (error: any) {
            console.error('[Auth] Logout error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Get current user profile (enriched with subscription info)
    ipcMain.handle('auth:get-user', async () => {
        if (!cachedProfile) {
            cachedProfile = await getProfile();
        }
        if (!cachedProfile) return null;

        // Enrich with subscription dates for UI display
        try {
            const session = await getSession();
            if (session && cachedProfile.plan === 'pro') {
                const resp = await fetch(
                    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${cachedProfile.id}&status=eq.active&order=created_at.desc&limit=1`,
                    {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                            'apikey': SUPABASE_ANON_KEY,
                        },
                    }
                );
                const subs = (await resp.json()) as any[];
                const latest = subs?.[0];

                if (latest) {
                    const periodStart = latest.current_period_start;
                    const periodEnd = latest.current_period_end;
                    // Determine plan type from period length
                    const periodMs = new Date(periodEnd).getTime() - new Date(periodStart).getTime();
                    const periodDays = periodMs / (1000 * 60 * 60 * 24);
                    const planType = periodDays > 60 ? 'pro_annual' : 'pro_monthly';

                    cachedProfile = {
                        ...cachedProfile,
                        planType,
                        periodStart,
                        periodEnd,
                    };
                }
            }
        } catch (e) {
            console.warn('[Auth] Sub info fetch failed:', (e as any)?.message);
        }

        return cachedProfile;
    });

    // Get usage summary
    ipcMain.handle('auth:get-usage', async () => {
        try {
            cachedUsage = await getUsageSummary();
            return cachedUsage;
        } catch {
            return { dailyAI: 0, dailyGrammar: 0, monthlyTotal: 0, limitReached: false };
        }
    });

    // Check if user is pro
    ipcMain.handle('auth:is-pro', async () => {
        return cachedProfile?.plan === 'pro';
    });

    // Update productivity metrics
    ipcMain.handle('auth:update-productivity', async (_, updates: { words_added?: number; wpm?: number }) => {
        try {
            await updateProductivityMetrics(updates);
            // Don't broadcast every time to avoid spamming, but update cache
            cachedProfile = await getProfile();
            return { success: true };
        } catch (error: any) {
            console.error('[Auth] Update productivity error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Create subscription (upgrade to Pro)
    ipcMain.handle('auth:create-subscription', async (_, { planType }: { planType: 'pro_monthly' | 'pro_annual' }) => {
        try {
            if (!cachedProfile) {
                return { success: false, error: 'Not authenticated' };
            }
            const { createSubscription } = await import('./razorpay');
            const result = await createSubscription(
                cachedProfile.id || '',
                planType,
                cachedProfile.email || ''
            );

            // After opening payment page, start polling profile for plan change
            if (result.success) {
                startProfilePolling();
            }

            return result;
        } catch (error: any) {
            console.error('[Auth] Create subscription error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Cancel subscription
    ipcMain.handle('auth:cancel-subscription', async () => {
        try {
            if (!cachedProfile) {
                return { success: false, error: 'Not authenticated' };
            }
            const { cancelSubscription } = await import('./razorpay');
            const result = await cancelSubscription(cachedProfile.id);
            if (result.success) {
                cachedProfile = await getProfile();
                broadcastAuthState();
            }
            return result;
        } catch (error: any) {
            console.error('[Auth] Cancel subscription error:', error.message);
            return { success: false, error: error.message };
        }
    });

    // Reactivate a cancelled subscription (still has remaining days)
    ipcMain.handle('auth:reactivate-subscription', async () => {
        try {
            if (!cachedProfile) {
                return { success: false, error: 'Not authenticated' };
            }
            const { reactivateSubscription } = await import('./razorpay');
            const result = await reactivateSubscription();
            if (result.success) {
                cachedProfile = await getProfile();
                broadcastAuthState();
            }
            return result;
        } catch (error: any) {
            console.error('[Auth] Reactivate subscription error:', error.message);
            return { success: false, error: error.message };
        }
    });
}

// ============================================
// OAuth via juskoe.in/auth/callback + local token relay
// ============================================

import * as http from 'http';

const AUTH_CALLBACK_PORT = 47831;
let callbackServer: http.Server | null = null;

/** Start the local token relay server (fixed port 47831) */
function ensureCallbackServer(): void {
    if (callbackServer) return;

    callbackServer = http.createServer(async (req, res) => {
        // CORS headers for cross-origin fetch from juskoe.in
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const reqUrl = new URL(req.url || '/', `http://localhost:${AUTH_CALLBACK_PORT}`);

        if (reqUrl.pathname === '/auth-complete') {
            const accessToken = reqUrl.searchParams.get('access_token');
            const refreshToken = reqUrl.searchParams.get('refresh_token');

            if (accessToken && refreshToken) {
                try {
                    console.log('[Auth] Tokens received via local relay, setting session...');
                    const session = await setSessionFromTokens(accessToken, refreshToken);
                    cachedProfile = await getProfile();
                    cachedUsage = await getUsageSummary();
                    broadcastAuthState();
                    console.log(`[Auth] OAuth login successful (${session.user?.email})`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));

                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                } catch (e: any) {
                    console.error('[Auth] Token processing error:', e.message);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Missing tokens' }));
            }
        } else if (reqUrl.pathname === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    callbackServer.listen(AUTH_CALLBACK_PORT, '127.0.0.1', () => {
        console.log(`[Auth] Token relay server listening on port ${AUTH_CALLBACK_PORT}`);
    });

    callbackServer.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`[Auth] Port ${AUTH_CALLBACK_PORT} in use (server may already be running)`);
        } else {
            console.error('[Auth] Token relay server error:', e.message);
        }
        callbackServer = null;
    });
}

/**
 * Opens Google OAuth in the user's default browser.
 * Flow:
 * 1. Ensure local token relay server is running on port 47831
 * 2. Get OAuth URL with redirectTo = https://juskoe.in/auth/callback
 * 3. Open in browser → Google OAuth → Supabase redirects to juskoe.in/auth/callback#tokens
 * 4. Callback page reads tokens from hash → sends to http://localhost:47831/auth-complete
 * 5. Local server sets session → done
 */
async function openOAuthInBrowser(): Promise<void> {
    try {
        ensureCallbackServer();

        const redirectTo = 'https://juskoe.in/auth/callback';
        console.log(`[Auth] Starting Google OAuth, redirectTo: ${redirectTo}`);

        const oauthUrl = await getGoogleOAuthURL(redirectTo);
        console.log('[Auth] OAuth URL generated, opening browser...');
        shell.openExternal(oauthUrl);
    } catch (e: any) {
        console.error('[Auth] Failed to start OAuth flow:', e.message);
    }
}

/**
 * Handle deep link callback from juskoe:// protocol (fallback).
 */
export async function handleDeepLinkAuth(url: string): Promise<void> {
    try {
        console.log('[Auth] Processing deep link:', url.substring(0, 80) + '...');
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');

        if (!accessToken || !refreshToken) {
            console.error('[Auth] Deep link missing tokens');
            return;
        }

        const session = await setSessionFromTokens(accessToken, refreshToken);
        cachedProfile = await getProfile();
        cachedUsage = await getUsageSummary();
        broadcastAuthState();
        console.log(`[Auth] Deep link auth successful (${session.user?.email})`);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
        }
    } catch (e: any) {
        console.error('[Auth] Deep link auth error:', e.message);
    }
}

// ============================================
// Exported helpers for main.ts to use
// ============================================

/** Check if user is authenticated */
export function isAuthenticated(): boolean {
    return !!cachedProfile;
}

/** Get cached profile (no async) */
export function getCachedProfile(): UserProfile | null {
    return cachedProfile;
}

/** Check if user is pro */
export function isPro(): boolean {
    return cachedProfile?.plan === 'pro';
}

/** Refresh usage cache */
export async function refreshUsage(): Promise<UsageSummary> {
    cachedUsage = await getUsageSummary();
    broadcastAuthState();
    return cachedUsage;
}

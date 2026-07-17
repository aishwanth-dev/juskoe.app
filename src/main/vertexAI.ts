// ============================================
// JUSKOE — Vertex AI (Gemini 2.5 Flash Lite)
// Primary AI provider — uses GCP $300 credit (ON_DEMAND billing)
//
// Auth: Service account JSON → JWT (RS256) → OAuth access token (cached 1h)
// Endpoint: global region (auto-routes to nearest, fastest in benchmarks)
// No external dependencies — pure Node crypto + Electron net.fetch
// ============================================

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app, net } from 'electron';

// ── Config ──
const VERTEX_MODEL = 'gemini-2.5-flash-lite';
const VERTEX_LOCATION = 'global';
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';

interface ServiceAccount {
    project_id: string;
    private_key: string;
    client_email: string;
    token_uri?: string;
}

// ── Lazy-loaded service account ──
let serviceAccount: ServiceAccount | null = null;
let saLoadAttempted = false;

/**
 * Locate and load the service account JSON.
 * Search order:
 *   1. env VERTEX_KEY_JSON (inline JSON string)
 *   2. env GOOGLE_APPLICATION_CREDENTIALS (file path)
 *   3. packaged resources:  <resources>/vertex-key.json
 *   4. dev workspace:        <cwd>/vertex-key.json
 *   5. alongside app:        <appPath>/vertex-key.json
 */
function loadServiceAccount(): ServiceAccount | null {
    if (saLoadAttempted) return serviceAccount;
    saLoadAttempted = true;

    // 1. Inline JSON from env
    const inline = process.env.VERTEX_KEY_JSON;
    if (inline && inline.trim().startsWith('{')) {
        try {
            serviceAccount = JSON.parse(inline);
            console.log('[Vertex] Loaded service account from VERTEX_KEY_JSON env');
            return serviceAccount;
        } catch (e) {
            console.warn('[Vertex] Failed to parse VERTEX_KEY_JSON:', (e as Error).message);
        }
    }

    // Build candidate file paths
    const candidates: string[] = [];
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    try {
        // Packaged: electron-builder extraResources copies to resourcesPath
        if (process.resourcesPath) {
            candidates.push(path.join(process.resourcesPath, 'vertex-key.json'));
            candidates.push(path.join(process.resourcesPath, 'assets', 'vertex-key.json'));
        }
    } catch { /* noop */ }
    try {
        candidates.push(path.join(app.getAppPath(), 'vertex-key.json'));
    } catch { /* noop */ }
    candidates.push(path.join(process.cwd(), 'vertex-key.json'));

    for (const file of candidates) {
        try {
            if (file && fs.existsSync(file)) {
                const raw = fs.readFileSync(file, 'utf8');
                serviceAccount = JSON.parse(raw);
                console.log(`[Vertex] Loaded service account from ${file}`);
                return serviceAccount;
            }
        } catch (e) {
            console.warn(`[Vertex] Failed to read ${file}:`, (e as Error).message);
        }
    }

    console.warn('[Vertex] No service account key found — Vertex disabled, will use fallback');
    return null;
}

/** Returns true if Vertex AI can be used (key is present). */
export function isVertexAvailable(): boolean {
    return loadServiceAccount() !== null;
}

// ── OAuth token cache ──
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function base64Url(input: Buffer | string): string {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/** Build + sign a JWT, exchange for an OAuth access token. */
async function fetchAccessToken(sa: ServiceAccount): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64Url(JSON.stringify({
        iss: sa.client_email,
        scope: TOKEN_SCOPE,
        aud: sa.token_uri || TOKEN_URI,
        iat: now,
        exp: now + 3600,
    }));
    const signingInput = `${header}.${claim}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = base64Url(signer.sign(sa.private_key));
    const jwt = `${signingInput}.${signature}`;

    const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await net.fetch(sa.token_uri || TOKEN_URI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
            signal: controller.signal as AbortSignal,
        });
        const text = await res.text();
        if (res.status >= 400) {
            throw new Error(`Vertex token ${res.status}: ${text.substring(0, 200)}`);
        }
        const data = JSON.parse(text);
        if (!data.access_token) throw new Error('Vertex token: no access_token in response');
        return data.access_token;
    } finally {
        clearTimeout(timer);
    }
}

/** Get a valid OAuth token (cached for 55 min). */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 60_000) {
        return cachedToken;
    }
    const token = await fetchAccessToken(sa);
    cachedToken = token;
    tokenExpiresAt = now + 3600_000; // 1 hour
    return token;
}

/**
 * Pre-warm the OAuth token in the background (call on app startup).
 * Saves ~400-700ms on the user's first AI request.
 */
export async function prewarmVertex(): Promise<void> {
    const sa = loadServiceAccount();
    if (!sa) return;
    try {
        await getAccessToken(sa);
        console.log('[Vertex] OAuth token pre-warmed');
    } catch (e) {
        console.warn('[Vertex] Pre-warm failed (non-fatal):', (e as Error).message);
    }
}

/**
 * Call Gemini 2.5 Flash Lite via Vertex AI.
 * Throws on failure so caller can fall back to OpenRouter.
 */
export async function callVertexGemini(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<string> {
    const sa = loadServiceAccount();
    if (!sa) throw new Error('[Vertex] Service account not available');

    const temperature = options?.temperature ?? 0.3;
    const maxOutputTokens = options?.maxTokens ?? 1000;
    const timeoutMs = options?.timeoutMs ?? 20000;

    const token = await getAccessToken(sa);

    const url =
        `https://aiplatform.googleapis.com/v1/projects/${sa.project_id}` +
        `/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;

    const requestBody = JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens, temperature },
    });

    const startTime = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await net.fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: requestBody,
            signal: controller.signal as AbortSignal,
        });
        const text = await res.text();

        // On auth failure, clear token so next attempt refreshes
        if (res.status === 401 || res.status === 403) {
            cachedToken = null;
            tokenExpiresAt = 0;
        }
        if (res.status >= 400) {
            throw new Error(`Vertex ${res.status}: ${text.substring(0, 300)}`);
        }

        const data: any = JSON.parse(text);
        const candidate = data?.candidates?.[0];
        const out: string = candidate?.content?.parts?.map((p: any) => p?.text || '').join('') ?? '';
        if (!out.trim()) {
            const finish = candidate?.finishReason || 'unknown';
            throw new Error(`Vertex: empty response (finishReason=${finish})`);
        }
        console.log(`[Vertex] Response in ${Date.now() - startTime}ms (model=${VERTEX_MODEL})`);
        return out.trim();
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error(`Vertex request timed out after ${timeoutMs}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

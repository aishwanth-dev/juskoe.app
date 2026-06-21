// ============================================
// Supabase Edge Function: ai-proxy
// Secure server-side AI proxy for JUSKOE.
//
// Provider order (all keys live ONLY in function env, never in the app):
//   1. Vertex AI  — gemini-2.5-flash-lite (global)   [VERTEX_SA_JSON]
//   2. OpenRouter — openai/gpt-oss-20b:free (rotate)  [OPENROUTER_KEYS]
//   3. AI Studio  — gemini-2.5-flash (legacy)         [KJUS]
//
// The client never sees any key. Requires a valid Supabase session.
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Vertex OAuth token (cached across warm invocations) ──
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function b64url(input: ArrayBuffer | string): string {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s+/g, '');
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        'pkcs8',
        der.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
    );
}

async function getVertexToken(sa: any): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && now < tokenExpiresAt - 60) return cachedToken;

    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }));
    const signingInput = `${header}.${claim}`;
    const key = await importPrivateKey(sa.private_key);
    const sigBuf = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput),
    );
    const jwt = `${signingInput}.${b64url(sigBuf)}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });
    if (!resp.ok) throw new Error(`token ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const j = await resp.json();
    cachedToken = j.access_token;
    tokenExpiresAt = now + (j.expires_in ?? 3600);
    return cachedToken!;
}

async function callVertex(systemPrompt: string, userPrompt: string, maxTokens: number, temp: number): Promise<string> {
    const raw = Deno.env.get('VERTEX_SA_JSON');
    if (!raw) throw new Error('VERTEX_SA_JSON not set');
    const sa = JSON.parse(raw);
    const token = await getVertexToken(sa);
    const url = `https://aiplatform.googleapis.com/v1/projects/${sa.project_id}` +
        `/locations/global/publishers/google/models/gemini-2.5-flash-lite:generateContent`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt || '' }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: temp },
        }),
    });
    if (!resp.ok) throw new Error(`vertex ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const d = await resp.json();
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) throw new Error('vertex empty response');
    return txt.trim();
}

async function callOpenRouter(systemPrompt: string, userPrompt: string, maxTokens: number, temp: number): Promise<string> {
    const keys = (Deno.env.get('OPENROUTER_KEYS') || '').split(',').map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) throw new Error('OPENROUTER_KEYS not set');
    let lastErr = 'no keys';
    for (const key of keys) {
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                    'HTTP-Referer': 'https://juskoe.com',
                    'X-Title': 'Juskoe',
                },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-20b:free',
                    messages: [
                        { role: 'system', content: systemPrompt || '' },
                        { role: 'user', content: userPrompt },
                    ],
                    max_tokens: maxTokens,
                    temperature: temp,
                }),
            });
            if (!resp.ok) { lastErr = `openrouter ${resp.status}`; continue; }
            const d = await resp.json();
            const txt = d?.choices?.[0]?.message?.content;
            if (txt) return txt.trim();
        } catch (e) {
            lastErr = String(e);
        }
    }
    throw new Error(`all openrouter keys failed: ${lastErr}`);
}

async function callAiStudio(systemPrompt: string, userPrompt: string, maxTokens: number, temp: number): Promise<string> {
    const key = Deno.env.get('KJUS');
    if (!key) throw new Error('KJUS not set');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const contents: any[] = [];
    if (systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
        contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: userPrompt }] });
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: temp, maxOutputTokens: maxTokens } }),
    });
    if (!resp.ok) throw new Error(`aistudio ${resp.status}`);
    const d = await resp.json();
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) throw new Error('aistudio empty');
    return txt.trim();
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    const startTime = Date.now();

    try {
        // ---- 1. Validate Supabase session ----
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return errorResponse(401, 'Missing authorization header', startTime);
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return errorResponse(401, 'Invalid or expired token', startTime);

        // ---- 2. Parse request ----
        const { systemPrompt, userPrompt, mode, maxTokens } = await req.json() as {
            systemPrompt?: string; userPrompt: string; mode: 'ai' | 'grammar'; maxTokens?: number;
        };
        if (!userPrompt) return errorResponse(400, 'Missing userPrompt', startTime);
        const tokens = maxTokens || (mode === 'grammar' ? 256 : 1024);
        const temp = mode === 'grammar' ? 0.1 : 0.3;

        // ---- 3. Provider chain: Vertex → OpenRouter → AI Studio ----
        let output = '';
        let provider = '';
        const errors: string[] = [];

        try {
            output = await callVertex(systemPrompt ?? '', userPrompt, tokens, temp);
            provider = 'vertex';
        } catch (e) {
            errors.push(`vertex: ${e}`);
            try {
                output = await callOpenRouter(systemPrompt ?? '', userPrompt, tokens, temp);
                provider = 'openrouter';
            } catch (e2) {
                errors.push(`openrouter: ${e2}`);
                try {
                    output = await callAiStudio(systemPrompt ?? '', userPrompt, tokens, temp);
                    provider = 'aistudio';
                } catch (e3) {
                    errors.push(`aistudio: ${e3}`);
                }
            }
        }

        if (!output) {
            console.error('[ai-proxy] all providers failed:', errors.join(' | '));
            return errorResponse(502, 'All AI providers failed', startTime);
        }

        return new Response(
            JSON.stringify({ success: true, output, provider, latencyMs: Date.now() - startTime }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        console.error('[ai-proxy] Error:', error);
        return errorResponse(500, (error as Error).message || 'Internal error', startTime);
    }
});

function errorResponse(status: number, message: string, startTime: number) {
    return new Response(
        JSON.stringify({ success: false, error: message, latencyMs: Date.now() - startTime }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
}

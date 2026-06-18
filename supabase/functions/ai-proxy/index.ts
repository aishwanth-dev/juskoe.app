// ============================================
// Supabase Edge Function: ai-proxy
// Secure server-side proxy for Gemini API
// API key stored in env var KJUS — never exposed to client
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('KJUS');
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        // ---- 1. Validate auth token ----
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return errorResponse(401, 'Missing authorization header', startTime);
        }

        // Create a Supabase client scoped to this request's auth token
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return errorResponse(401, 'Invalid or expired token', startTime);
        }

        // ---- 2. Check API key is configured ----
        if (!GEMINI_API_KEY) {
            console.error('[ai-proxy] KJUS env var not set!');
            return errorResponse(500, 'AI service not configured', startTime);
        }

        // ---- 3. Parse request ----
        const body = await req.json();
        const { systemPrompt, userPrompt, mode, maxTokens } = body as {
            systemPrompt?: string;
            userPrompt: string;
            mode: 'ai' | 'grammar';
            maxTokens?: number;
        };

        if (!userPrompt) {
            return errorResponse(400, 'Missing userPrompt', startTime);
        }

        // ---- 4. Call Gemini with server-side key ----
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const contents: any[] = [];
        if (systemPrompt) {
            contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
            contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
        }
        contents.push({ role: 'user', parts: [{ text: userPrompt }] });

        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: mode === 'grammar' ? 0.1 : 0.3,
                    maxOutputTokens: maxTokens || (mode === 'grammar' ? 256 : 1024),
                },
            }),
        });

        if (!geminiResponse.ok) {
            const errText = await geminiResponse.text();
            console.error('[ai-proxy] Gemini error:', errText);
            return errorResponse(502, `AI model error: ${geminiResponse.status}`, startTime);
        }

        const geminiData = await geminiResponse.json();
        const output = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        // ---- 5. Return result ----
        return new Response(
            JSON.stringify({
                success: true,
                output,
                latencyMs: Date.now() - startTime,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[ai-proxy] Error:', error);
        return errorResponse(500, error.message || 'Internal error', startTime);
    }
});

function errorResponse(status: number, message: string, startTime: number) {
    return new Response(
        JSON.stringify({ success: false, error: message, latencyMs: Date.now() - startTime }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}

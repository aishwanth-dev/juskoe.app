// ============================================
// Supabase Edge Function: process-voice
// Main AI pipeline for voice commands
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('KJUS') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoiceRequest {
    audio?: string; // Base64 encoded audio
    transcript?: string;
    mode: 'ai' | 'grammar';
    selectedText?: string;
    role?: string;
}

interface VoiceResponse {
    success: boolean;
    transcript: string;
    intent: string;
    processedText: string;
    action?: {
        type: string;
        target?: string;
        content: string;
    };
    latencyMs: number;
    error?: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        // ---- Auth validation ----
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing authorization header', latencyMs: Date.now() - startTime }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Validate JWT via Supabase
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ success: false, error: 'Invalid or expired token', latencyMs: Date.now() - startTime }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const request: VoiceRequest = await req.json();

        // Step 1: Transcribe audio if provided
        let transcript = request.transcript || '';

        if (request.audio && !transcript) {
            transcript = await transcribeWithWhisper(request.audio);
        }

        if (!transcript) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'No transcript available',
                    latencyMs: Date.now() - startTime,
                } as VoiceResponse),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Step 2: Process based on mode
        let processedText: string;
        let intent = 'write';
        let action: any;

        if (request.mode === 'grammar') {
            // Grammar mode - just fix errors
            processedText = await processGrammar(transcript);
            intent = 'grammar';
        } else {
            // AI mode - detect intent and process
            const intentResult = await detectIntent(transcript, request.selectedText);
            intent = intentResult.intent;
            action = intentResult.action;

            switch (intent) {
                case 'rewrite':
                    processedText = request.selectedText
                        ? await rewriteText(request.selectedText, transcript, request.role)
                        : await generateText(transcript, request.role);
                    break;

                case 'grammar':
                    processedText = await processGrammar(request.selectedText || transcript);
                    break;

                case 'save_note':
                    processedText = await polishNote(action?.content || transcript);
                    break;

                default:
                    processedText = await generateText(transcript, request.role);
                    break;
            }
        }

        const response: VoiceResponse = {
            success: true,
            transcript,
            intent,
            processedText,
            action,
            latencyMs: Date.now() - startTime,
        };

        return new Response(
            JSON.stringify(response),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                latencyMs: Date.now() - startTime,
            } as VoiceResponse),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});

// ============================================
// Whisper Transcription
// ============================================

async function transcribeWithWhisper(audioBase64: string): Promise<string> {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    // Decode base64 to binary
    const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

    const formData = new FormData();
    formData.append('file', new Blob([audioData], { type: 'audio/webm' }), 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.text;
}

// ============================================
// Gemini API Calls
// ============================================

async function callGemini(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function detectIntent(transcript: string, selectedText?: string) {
    const prompt = `Classify this voice command. Return ONLY JSON.

Command: "${transcript}"
${selectedText ? `Selected text: "${selectedText}"` : ''}

Return:
{
  "intent": "write|rewrite|grammar|save_note|send_email|insert_snippet",
  "target": "name/key if applicable",
  "content": "main content"
}`;

    const response = await callGemini(prompt);
    try {
        const match = response.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match?.[0] || '{}');
        return { intent: parsed.intent || 'write', action: parsed };
    } catch {
        return { intent: 'write', action: { content: transcript } };
    }
}

async function processGrammar(text: string): Promise<string> {
    return callGemini(`Fix only grammar, spelling, and punctuation. Return only the corrected text:\n\n"${text}"`);
}

async function rewriteText(text: string, instruction: string, role?: string): Promise<string> {
    const rolePrompt = role ? `Write as: ${role}.` : '';
    return callGemini(`${rolePrompt}\nTask: ${instruction}\nText: "${text}"\n\nReturn only the rewritten text.`);
}

async function generateText(instruction: string, role?: string): Promise<string> {
    const rolePrompt = role ? `Write as: ${role}.` : '';
    return callGemini(`${rolePrompt}\nTask: ${instruction}\n\nReturn only the generated text.`);
}

async function polishNote(text: string): Promise<string> {
    return callGemini(`Clean up and organize this note. Keep it concise:\n\n"${text}"`);
}

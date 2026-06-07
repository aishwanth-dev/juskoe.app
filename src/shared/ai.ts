import { GEMINI_API_KEY, GEMINI_MODEL } from './config';
import { VoiceRequest, VoiceResponse, IntentType, ActionPayload } from './types';

// ============================================
// Gemini Client (Intent & Rewrite)
// Using Gemini 2.5 Flash-Lite for speed
// ============================================

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
    const startTime = Date.now();

    const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2, // Lower for faster, more deterministic responses
                maxOutputTokens: 1024, // Reduced for speed
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`[Gemini] Response took ${Date.now() - startTime}ms`);
    return text.trim();
}

// ============================================
// Fast Intent Detection
// ============================================

export async function detectIntent(transcript: string, selectedText?: string): Promise<{ intent: IntentType; action?: ActionPayload }> {
    // Quick keyword matching for common intents (faster than API call)
    const lowerTranscript = transcript.toLowerCase();

    // Fast path: Grammar keywords
    if (lowerTranscript.includes('fix grammar') || lowerTranscript.includes('correct this') || lowerTranscript.includes('grammar check')) {
        return { intent: 'grammar', action: { type: 'grammar', content: selectedText || transcript } };
    }

    // Fast path: Save note keywords
    if (lowerTranscript.includes('save') && (lowerTranscript.includes('note') || lowerTranscript.includes('remember'))) {
        return { intent: 'save_note', action: { type: 'save_note', content: transcript } };
    }

    // Fast path: Email keywords
    if (lowerTranscript.includes('send') && (lowerTranscript.includes('email') || lowerTranscript.includes('mail'))) {
        const nameMatch = transcript.match(/(?:to|email)\s+(\w+)/i);
        return { intent: 'send_email', action: { type: 'send_email', target: nameMatch?.[1], content: transcript } };
    }

    // Fast path: Rewrite if there's selected text
    if (selectedText && selectedText.length > 0) {
        return { intent: 'rewrite', action: { type: 'rewrite', content: transcript } };
    }

    // Default: Write/generate
    return { intent: 'write', action: { type: 'write', content: transcript } };
}

// ============================================
// Text Processing
// ============================================

export async function processGrammar(text: string): Promise<string> {
    const prompt = `Fix grammar/spelling only. Return ONLY the corrected text:\n\n"${text}"`;
    return await callGemini(prompt);
}

export async function rewriteText(text: string, instruction: string, role?: string): Promise<string> {
    const rolePrompt = role ? `Style: ${role}.` : '';
    const prompt = `${rolePrompt}\nTask: ${instruction}\nText: "${text}"\n\nReturn only rewritten text:`;
    return await callGemini(prompt);
}

export async function generateText(instruction: string, role?: string): Promise<string> {
    const rolePrompt = role ? `Style: ${role}.` : '';
    const prompt = `${rolePrompt}\nTask: ${instruction}\n\nReturn only the text:`;
    return await callGemini(prompt);
}

export async function polishForNote(text: string): Promise<string> {
    const prompt = `Clean up this note briefly:\n\n"${text}"`;
    return await callGemini(prompt);
}

// ============================================
// Main Voice Processing Pipeline
// Target: < 2 seconds total
// ============================================

export async function processVoiceCommand(request: VoiceRequest): Promise<VoiceResponse> {
    const startTime = Date.now();

    try {
        // Use the provided transcript (from Web Speech API)
        const transcript = request.transcript || '';

        if (!transcript) {
            return {
                success: false,
                transcript: '',
                intent: 'write',
                processedText: '',
                latencyMs: Date.now() - startTime,
                error: 'No transcript provided',
            };
        }

        // Grammar mode - just fix grammar (fast path)
        if (request.mode === 'grammar') {
            const textToFix = request.selectedText || transcript;
            const processedText = await processGrammar(textToFix);

            return {
                success: true,
                transcript,
                intent: 'grammar',
                processedText,
                latencyMs: Date.now() - startTime,
            };
        }

        // AI mode - detect intent (uses fast keyword matching)
        const { intent, action } = await detectIntent(transcript, request.selectedText);

        // Process based on intent
        let processedText = '';

        switch (intent) {
            case 'rewrite':
                if (request.selectedText) {
                    processedText = await rewriteText(request.selectedText, transcript, request.role);
                } else {
                    processedText = await generateText(transcript, request.role);
                }
                break;

            case 'grammar':
                processedText = await processGrammar(request.selectedText || transcript);
                break;

            case 'save_note':
                processedText = await polishForNote(action?.content || transcript);
                break;

            case 'send_email':
            case 'insert_snippet':
                processedText = action?.content || transcript;
                break;

            case 'write':
            default:
                processedText = await generateText(transcript, request.role);
                break;
        }

        const latencyMs = Date.now() - startTime;
        console.log(`[AI] Total processing: ${latencyMs}ms`);

        return {
            success: true,
            transcript,
            intent,
            processedText,
            action,
            latencyMs,
        };

    } catch (error) {
        console.error('[AI] Processing error:', error);
        return {
            success: false,
            transcript: '',
            intent: 'write',
            processedText: '',
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

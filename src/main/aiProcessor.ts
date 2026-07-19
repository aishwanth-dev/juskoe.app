// ============================================
// JUSKOE - Enhanced AI Processing
// F7 = AI Mode (anything)
// F8 = Grammar Mode (fixes only)
// OpenRouter MiniMax M2.5 (free) — key stays in main process
// Real-time Dictionary & Snippet Processing
// ============================================

import * as https from 'https';
import { net } from 'electron';
import { AppContext } from './appContext';
import { callVertexGemini, isVertexAvailable } from './vertexAI';
import {
    getSetting,
    getAllSnippets,
    getAllDictionaryWords,
    applyDictionaryCorrections,
    getSnippetByKey,
    addNote,
    getActiveStyle,
} from './localStorage';

// ============================================
// OpenRouter — Ordered fallback key pool
// Keys are tried in order; next key activates only on 401/429/402/403
// ============================================
// OpenRouter API keys loaded from environment (lazy — evaluated on first use
// so it works regardless of when the .env file is loaded at startup)
function getOpenRouterKeys(): string[] {
    return (process.env.OPENROUTER_KEYS || '').split(',').map(k => k.trim()).filter(k => k.length > 0);
}
const OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';

// ============================================
// Real-time Processing Functions
// ============================================

/**
 * Escape regex special chars so a snippet key with `.` `*` `(` etc. cannot
 * accidentally form a broad regex that swallows arbitrary text.
 */
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace snippet triggers in text with their content.
 *
 * Bug 1 fix: snippets must ONLY fire when the user explicitly invokes them
 * with one of the prefixes `add | insert | use | paste | my` immediately
 * before the snippet key. Without this, a snippet whose `key` is a common
 * word (e.g. "email") and whose `content` is a long paragraph rewrites every
 * transcript that happens to contain that word — exactly the stale-prompt
 * symptom the user reported.
 *
 * The unbounded `\b${snippet.title}\b` regex is removed for the same reason.
 *
 * Length guard: snippets with content > 500 chars or key < 2 chars are
 * skipped and logged. A real snippet is short and has a meaningful trigger;
 * anything longer is almost certainly a poisoned entry from past data.
 */
function replaceSnippetsInText(text: string): { result: string; replacements: string[] } {
    const allSnippets = getAllSnippets();
    let result = text;
    const replacements: string[] = [];

    for (const snippet of allSnippets) {
        const key = (snippet.key || '').trim();
        if (key.length < 2 || (snippet.content || '').length > 500) {
            console.warn(
                `[Snippets] Skipping malformed entry id=${snippet.id}` +
                ` key="${key.substring(0, 40)}" contentLen=${(snippet.content || '').length}`
            );
            continue;
        }

        // Require an explicit prefix so a bare common word does not trigger.
        const trigger = new RegExp(
            `\\b(?:add|insert|use|paste|my)\\s+${escapeRegex(key)}\\b`,
            'gi'
        );

        if (trigger.test(result)) {
            result = result.replace(trigger, snippet.content);
            replacements.push(`"${key}" → "${snippet.content.substring(0, 30)}..."`);
            console.log(`[Snippet] Replaced "${key}" with content`);
        }
    }

    return { result, replacements };
}

/**
 * Process transcript in real-time:
 * 1. Apply dictionary corrections
 * 2. Replace snippet triggers with content
 * 3. Detect special commands (save to notes, etc.)
 */
export function processTranscriptRealtime(transcript: string): {
    correctedText: string;
    snippetMatch: { key: string; content: string } | null;
    wasModified: boolean;
    shouldSaveToNotes: boolean;
    noteContent: string;
} {
    // Step 1: Apply dictionary corrections
    let correctedText = applyDictionaryCorrections(transcript);
    const dictModified = correctedText !== transcript;

    if (dictModified) {
        console.log(`[Dictionary] Auto-corrected: "${transcript}" → "${correctedText}"`);
    }

    // Step 2: Detect "save to notes" command
    const saveToNotesPattern = /(?:save|add|store)(?:\s+(?:this|it|that))?\s+(?:to|in|as)?\s*(?:notes?|remember)/i;
    const shouldSaveToNotes = saveToNotesPattern.test(correctedText);
    let noteContent = '';

    if (shouldSaveToNotes) {
        // Extract the content to save (remove the save command)
        noteContent = correctedText.replace(saveToNotesPattern, '').trim();
        console.log(`[Notes] Will save: "${noteContent.substring(0, 50)}..."`);
    }

    // Step 3: Replace snippet triggers with their content
    const { result: snippetReplacedText, replacements } = replaceSnippetsInText(correctedText);
    if (replacements.length > 0) {
        correctedText = snippetReplacedText;
        console.log(`[Snippets] Replaced ${replacements.length} snippet(s)`);
    }

    // Step 4: Check for direct snippet insertion (just the key)
    let snippetMatch: { key: string; content: string } | null = null;
    const allSnippets = getAllSnippets();

    // Only for very short commands that are just snippet keys
    if (transcript.split(' ').length <= 4) {
        const insertPattern = /(?:insert|paste|add)\s+(?:my\s+)?(.+)/i;
        const match = transcript.match(insertPattern);
        if (match) {
            const potentialKey = match[1].toLowerCase().trim();
            const snippet = allSnippets.find(s =>
                s.key.toLowerCase() === potentialKey ||
                s.title.toLowerCase() === potentialKey
            );
            if (snippet) {
                snippetMatch = { key: snippet.key, content: snippet.content };
                console.log(`[Snippet] Direct insert: "${snippet.title}"`);
            }
        }
    }

    return {
        correctedText,
        snippetMatch,
        wasModified: dictModified || replacements.length > 0,
        shouldSaveToNotes,
        noteContent
    };
}

// ============================================
// JUSKOE SYSTEM PROMPTS
// ============================================

/**
 * Build full context block (snippets + dictionary + writing style) for any prompt.
 */
function buildUserContext(): { snippetBlock: string; dictBlock: string } {
    const allSnippets = getAllSnippets();
    const snippetBlock = allSnippets.length > 0
        ? allSnippets.map(s => `  • "${s.key}" → ${s.content.substring(0, 120)}${s.content.length > 120 ? '...' : ''}`).join('\n')
        : '';

    const dictWords = getAllDictionaryWords();
    const dictBlock = dictWords.length > 0
        ? dictWords.map(d => `  • "${d.word}" → ${d.corrections[0]}`).join('\n')
        : '';

    return { snippetBlock, dictBlock };
}

/**
 * F7 - AI Mode System Prompt
 */
function getAIModeSystemPrompt(appContext: AppContext, userStyle?: { prompt: string; language: string }): string {
    const outputLanguage = userStyle?.language || 'English';
    const customRole = userStyle?.prompt || '';
    const { snippetBlock, dictBlock } = buildUserContext();

    const isAutoLang = outputLanguage === 'Auto';
    const langRule = isAutoLang
        ? 'Respond in the SAME language as the input.'
        : `Translate to ${outputLanguage} if input is in another language.`;

    return `You are Juskoe AI — a silent engine in a voice-to-text productivity app. The user spoke a request. Output paste-ready text.

ABSOLUTE RULES:
- NO analysis, NO fillers ("Sure", "Here is"), NO questions, NO explaining what you did.
- Never describe the input. If the user says "write an email" → output the email. "explain X" → the explanation. "rewrite" → the rewrite.
- Never use markdown code fences. For code, use plain prose (approach + key files + commands).
- Never stop mid-answer. Complete the full response.
- The output's first character IS the result itself.
- Format appropriately: use ## headings for structured content, • bullets for lists, numbered steps for sequences, paragraphs for prose. Let the content dictate the format.
- If the user lists items or mentions a sequence → format as bullets or numbered list.
- For emails/letters → proper salutation + body + sign-off.
- For explanations → clear paragraphs with structure.
- For creative writing → flowing prose.
- If unclear/impossible: {"trigger":true,"message":"3 to 5 word reason"}

SNIPPETS (user's saved shortcuts — silently USE them when they are relevant to the request. Do NOT list them in output):
${snippetBlock || '  (none)'}

DICTIONARY (custom spellings/names — silently respect these):
${dictBlock || '  (none)'}

OUTPUT LENGTH — AI DECIDES:
The user didn't specify a length, so choose what fits best. These are hints — trust your judgment:
• Quick thought / short answer → whatever it needs, even 5 words is fine
• Email / message / letter → full document, typically 200-600 words
• Deep explanation / plan / guide / strategy → structured, 600-1500 words
• Code / tech approach → architecture + steps, 500-1200 words
• Rewrite / polish / improve → match input length naturally
• User explicitly said "short" or "brief" → keep it concise
• User explicitly said "detailed" or "comprehensive" → go deeper
• Hard ceiling: 1600 words. Complete your thought before it.
• If a specific limit makes sense (e.g. email ≈ 200-600 words), use it. If not, don't force one.
• NEVER truncate mid-sentence or mid-thought.

CONTEXT (absorb silently):
- App: ${appContext.appName} (${appContext.appType})  |  Tone: ${appContext.suggestedTone}
- Language: ${isAutoLang ? 'same as input' : outputLanguage}${customRole ? `\n- Active writing style: ${customRole}` : ''}
${langRule}

Output the result. Nothing else.`;
}

/**
 * F8 - Grammar Mode (Voice Cleaner + Context)
 */
function getGrammarModeSystemPrompt(): string {
    const { snippetBlock, dictBlock } = buildUserContext();
    return `You are a speech-to-text cleaner with full context. Clean the spoken input, fix grammar, and output ONE clean result.

CLEANING RULES:
- Remove: "um", "uh", "uhh", "umm", "hmm", "ahh", "err", "like um" (hesitations)
- Normalize: "waitttttt" → "wait", "sooooo" → "so", "okaaaay" → "okay" (elongated)
- Remove restarts: "no wait", "no no", "sorry sorry", "let me start again", "scratch that"
- Fix false starts: "The pro— I mean the main file" → "The main file"
- Keep: idk, omg, lol, brb, btw, imo, tbh (casual is fine)
- Keep: technical words, names, code terms, questions, instructions — preserve exactly
- Fix: spelling, grammar, punctuation, capitalization
- Format: lists naturally (bullets • for items, numbered for steps), paragraphs for prose

SNIPPETS (user's shortcuts — USE them silently if they naturally fit the context):
${snippetBlock || '  (none)'}

DICTIONARY (custom spellings — respect these):
${dictBlock || '  (none)'}

OUTPUT: ONLY the cleaned text. No headers, no explanation, no alternatives.
If unable: {"trigger":true,"message":"3 to 5 word reason"}`;
}

// ============================================
// Notes Mode (F9)
// ============================================

function getNotesSystemPrompt(): string {
    const { snippetBlock, dictBlock } = buildUserContext();
    return `You are a voice note formatter. Clean the spoken note and format it neatly.

- Remove: um, uh, uhh, umm, hmm, ahh, err, no wait, sorry, false starts
- Fix: spelling, grammar, capitalization, punctuation
- Format by content type:
  • List of items/tasks → • bullets, one per line
  • Single idea/thought → clean paragraph
  • To-do / reminder → start with the action verb ("Buy...", "Call...", "Fix...", "Email...")
  • Meeting notes / recap → short paragraphs or bullets with key points
- Keep casual words (idk, omg, etc.) — they're part of the note
- Do NOT add content that wasn't spoken

SNIPPETS (silently use if relevant):
${snippetBlock || '  (none)'}

DICTIONARY (respect these spellings):
${dictBlock || '  (none)'}

Output ONLY the formatted note. No headers, no labels, no added content.`;
}

// ============================================
// Email Generation Prompt
// ============================================

export async function processNotesMode(transcript: string): Promise<{ success: boolean; text: string; error?: string }> {
    try {
        // Apply dictionary corrections first
        let cleaned = applyDictionaryCorrections(transcript);

        // Call AI to clean + format — no cap, output as much as the user spoke
        console.log(`[Notes] Input: ${cleaned.split(' ').length} words → uncapped`);
        const formatted = await callGemini(getNotesSystemPrompt(), cleaned, { temperature: 0.1, maxTokens: 1500 });
        const finalText = formatted.trim() || cleaned;

        // Save to local notes with voice-note tag
        addNote(finalText, ['voice-note']);
        console.log(`[Notes] Saved cleaned note: "${finalText.substring(0, 60)}"`);

        return { success: true, text: finalText };
    } catch (error) {
        // Fallback: save raw cleaned transcript if AI fails
        const fallback = applyDictionaryCorrections(transcript);
        addNote(fallback, ['voice-note']);
        console.warn('[Notes] AI failed, saved raw transcript');
        return { success: true, text: fallback };
    }
}

// ============================================
// Bad AI Response Detection
// ============================================

/**
 * Patterns that indicate the AI returned a meta-analysis or explanation
 * instead of the actual requested output. These responses should be
 * rejected and trigger the error capsule instead of being pasted.
 */
const BAD_RESPONSE_PATTERNS = [
  /^this\s+(statement|passage|text|sentence|paragraph|content|user['’]s|passage|phrase)\s+(appears|seems|looks|is|was|has|does|contains|suggests|reflects|could|might|can)/i,
  /^the\s+(statement|passage|text|sentence|paragraph|content|user['’]s|passage|phrase)\s+(appears|seems|looks|is|was|has|does|contains|suggests|reflects|could|might|can)/i,
  /^here\s+(is|are|['’]s)\s+(the|a|an)\s+(rewritten|corrected|polished|improved|revised|formatted|analyzed|response|version|result|output|edited|modified|text)/i,
  /^i\s+(have|'ve|had)\s+(rewritten|corrected|polished|improved|revised|formatted|analyzed|edited|modified)/i,
  /^(rewritten|corrected|polished|improved|revised|formatted|analyzed|edited|modified)\s+(version|text|response|output)/i,
  /^output\s*[:.]/i,
  /^result\s*[:.]/i,
  /^response\s*[:.]/i,
  /^sure[!,\s]/i,
  /^of\s+course[!,\s]/i,
  /^here['’]s\s+(a|the)\s+(rewritten|corrected|polished|improved|revised|formatted|version|response|output|result)/i,
  /^i['’]d\s+(be\s+)?(happy|glad|pleased)\s+to/i,
  /^let\s+me\s+(rewrite|correct|polish|improve|revise|format|analyze|explain|break\s+down)/i,
  /^the\s+(rewritten|corrected|polished|improved|revised|formatted|analyzed)\s+(text|version|passage|content)/i,
];

export function isBadAIResponse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const match = BAD_RESPONSE_PATTERNS.some(pattern => pattern.test(trimmed));
  if (match) {
    console.warn(`[AI] Bad response pattern detected: "${trimmed.substring(0, 100)}"`);
  }
  return match;
}

// ============================================
// AI Processing Functions
// ============================================

interface AIRequest {
    transcript: string;
    selectedText?: string;
    mode: 'ai' | 'grammar';
    appContext: AppContext;
}

interface AIResponse {
    success: boolean;
    output: string;
    intent?: string;
    error?: string;
    wasSnippet?: boolean;
    savedToNotes?: boolean;
}

/**
 * Call OpenRouter using Electron's net.fetch (modern API, Electron 28+).
 * Works correctly in both dev AND packaged .exe builds.
 * Falls back to Node.js https if Electron networking fails (SSL/DNS edge cases).
 */
async function httpsPost(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<string> {
    // Primary: Electron's net.fetch — uses Chromium's full network stack
    // Handles SSL certificates, DNS, proxies correctly in packaged apps
    try {
        return await _electronFetch(url, headers, body, timeoutMs);
    } catch (err: any) {
        // If it's an HTTP error (4xx/5xx), re-throw immediately (don't fallback)
        if (err?.message?.match(/OpenRouter \d{3}:/)) {
            throw err;
        }
        // Connection/SSL/DNS failure — try Node.js https as fallback
        console.warn('[AI] net.fetch failed, falling back to Node.js https:', err?.message?.substring(0, 100));
        return await _nodeHttpsPost(url, headers, body, timeoutMs);
    }
}

/** Electron net.fetch — primary method */
async function _electronFetch(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await net.fetch(url, {
            method: 'POST',
            headers: { ...headers },
            body,
            signal: controller.signal as AbortSignal,
        });

        const data = await response.text();

        if (response.status >= 400) {
            throw new Error(`OpenRouter ${response.status}: ${data}`);
        }
        return data;
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/** Node.js https — fallback for edge cases */
function _nodeHttpsPost(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const done = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
        const urlObj = new URL(url);

        const options: https.RequestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body).toString(),
            },
            timeout: timeoutMs,
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    done(() => reject(new Error(`OpenRouter ${res.statusCode}: ${data}`)));
                } else {
                    done(() => resolve(data));
                }
            });
        });

        req.on('error', (e: Error) => done(() => reject(e)));
        req.on('timeout', () => {
            req.destroy();
            done(() => reject(new Error(`OpenRouter request timed out after ${timeoutMs}ms`)));
        });

        req.write(body);
        req.end();
    });
}

async function callGemini(systemPrompt: string, userPrompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    // ── PRIMARY: Vertex AI (Gemini 2.5 Flash Lite, $300 GCP credit) ──
    if (isVertexAvailable()) {
        try {
            const startTime = Date.now();
            const text = await callVertexGemini(systemPrompt, userPrompt, {
                temperature: options?.temperature ?? 0.3,
                maxTokens: options?.maxTokens ?? 500,
                timeoutMs: 20000,
            });
            if (text.trim()) {
                console.log(`[AI] Vertex primary succeeded in ${Date.now() - startTime}ms`);
                return text.trim();
            }
            console.warn('[AI] Vertex returned empty — falling back to OpenRouter');
        } catch (err: any) {
            console.warn('[AI] Vertex failed, falling back to OpenRouter:', (err?.message || '').substring(0, 120));
        }
    }

    // ── FALLBACK: OpenRouter (free-tier key pool) ──
    return callOpenRouter(systemPrompt, userPrompt, options);
}

async function callOpenRouter(systemPrompt: string, userPrompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const startTime = Date.now();
    const temperature = options?.temperature ?? 0.3;
    const max_tokens = options?.maxTokens ?? 500;

    const requestBody = JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature,
        max_tokens,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
        ],
    });

    const requestHeaders = (key: string): Record<string, string> => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://juskoe.in',
        'X-Title': 'Juskoe',
    });

    // Try each key in order — move to next only on auth/rate errors
    const OPENROUTER_KEYS = getOpenRouterKeys();
    if (OPENROUTER_KEYS.length === 0) {
        throw new Error('[AI] No OpenRouter keys configured and Vertex unavailable');
    }
    for (let keyIdx = 0; keyIdx < OPENROUTER_KEYS.length; keyIdx++) {
        const key = OPENROUTER_KEYS[keyIdx];
        const isLastKey = keyIdx === OPENROUTER_KEYS.length - 1;

        // Each key gets up to 2 retries for transient 503/overload errors
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const rawResponse = await httpsPost(
                    'https://openrouter.ai/api/v1/chat/completions',
                    requestHeaders(key),
                    requestBody,
                    90000
                );

                const data: any = JSON.parse(rawResponse);
                const text: string = data?.choices?.[0]?.message?.content ?? '';
                console.log(`[AI] Response (key #${keyIdx + 1}) in ${Date.now() - startTime}ms`);
                return text.trim();

            } catch (error: any) {
                const msg: string = error?.message || '';
                const status = parseInt(msg.match(/(\d{3})/)?.[1] || '0');

                const isAuthError = status === 401 || status === 402 || status === 403;
                const isRateLimit = status === 429;
                const isTransient = status === 503 || msg.includes('overloaded') || msg.includes('high demand');

                if (isAuthError || isRateLimit) {
                    console.warn(`[AI] Key #${keyIdx + 1} failed (${status}) — trying next key`);
                    break; // Break inner loop → next key
                }

                if (isTransient && attempt === 0) {
                    console.warn(`[AI] Key #${keyIdx + 1} transient error, retrying in 1s...`);
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                if (isLastKey) {
                    console.error(`[AI] All keys exhausted. Last error:`, msg);
                    throw error;
                }

                console.warn(`[AI] Key #${keyIdx + 1} error (${msg.substring(0, 60)}) — trying next key`);
                break; // Try next key on any unhandled error
            }
        }
    }

    throw new Error('[AI] All OpenRouter keys failed');
}

/**
 * Detect intent from transcript
 */
function detectIntent(transcript: string): { intent: string; target?: string } {
    const lower = transcript.toLowerCase();

    if (lower.includes('save') && (lower.includes('note') || lower.includes('remember'))) {
        return { intent: 'save_note' };
    }

    if (lower.includes('send') && (lower.includes('email') || lower.includes('mail'))) {
        const nameMatch = transcript.match(/(?:to|email)\s+(\w+)/i);
        return { intent: 'send_email', target: nameMatch?.[1] };
    }

    if (lower.includes('insert') || lower.includes('paste')) {
        const snippetMatch = transcript.match(/(?:insert|paste)\s+(?:my\s+)?(.+)/i);
        return { intent: 'insert_snippet', target: snippetMatch?.[1] };
    }

    if (lower.includes('translate')) {
        return { intent: 'translate' };
    }

    if (lower.includes('prompt') || lower.includes('generate prompt')) {
        return { intent: 'generate_prompt' };
    }

    if (lower.includes('email') || lower.includes('mail')) {
        return { intent: 'write_email' };
    }

    if (lower.includes('explain')) {
        return { intent: 'explain' };
    }

    if (lower.includes('summarize') || lower.includes('summary')) {
        return { intent: 'summarize' };
    }

    return { intent: 'general' };
}

/**
 * Estimate max tokens for grammar/notes based on input word count.
 * Output should be proportional — just the cleaned version of what was spoken.
 */
function estimateGrammarTokens(inputText: string, hardMax: number): number {
    const wordCount = inputText.trim().split(/\s+/).length;
    // Each word ≈ 1.5 tokens; give 2x room for cleanup/formatting
    const estimated = Math.ceil(wordCount * 2.5);
    return Math.max(80, Math.min(estimated, hardMax));
}

/**
 * Process AI Mode (F7) request
 */
async function processAIMode(request: AIRequest): Promise<AIResponse> {
    try {
        // Step 1: Real-time processing (dictionary + snippets + save to notes)
        const {
            correctedText,
            snippetMatch,
            wasModified,
            shouldSaveToNotes,
            noteContent
        } = processTranscriptRealtime(request.transcript);

        // Handle save to notes command
        if (shouldSaveToNotes && noteContent) {
            addNote(noteContent, ['voice-note']);
            console.log(`[Notes] Saved: "${noteContent.substring(0, 50)}..."`);
            return {
                success: true,
                output: `✓ Saved to notes: "${noteContent.substring(0, 100)}${noteContent.length > 100 ? '...' : ''}"`,
                intent: 'save_note',
                savedToNotes: true,
            };
        }

        // If snippet direct match, return it immediately
        if (snippetMatch) {
            return {
                success: true,
                output: snippetMatch.content,
                intent: 'insert_snippet',
                wasSnippet: true,
            };
        }

        // AI mode: use active writing style (prompt + language) from localStorage
        const activeStyle = getActiveStyle();
        const styleLang = activeStyle?.language || getSetting('translateTo') || 'English';
        const stylePrompt = activeStyle?.prompt || '';

        // Append custom system prompt if user has one
        const customSystemPrompt = getSetting('systemPrompt') || '';
        let extraInstructions = stylePrompt;
        if (customSystemPrompt.trim()) {
            extraInstructions = extraInstructions
                ? `${extraInstructions}\n${customSystemPrompt.trim()}`
                : customSystemPrompt.trim();
        }

        // Get system prompt
        const systemPrompt = getAIModeSystemPrompt(
            request.appContext,
            { prompt: extraInstructions, language: styleLang }
        );

        // Build user prompt
        let userPrompt: string;

        if (request.selectedText && request.selectedText.trim()) {
            userPrompt = `Apply the voice instruction to the selected text. Output ONLY the result.

SELECTED TEXT:
${request.selectedText}

INSTRUCTION: "${correctedText}"

RULES:
- Output ONLY the result. First character = result itself.
- No labels, no "Here is", no descriptions, no headers.
- If instruction is empty/unclear → clean and polish the text.
- If selected text is messy speech → clean it up.
- Intents: "rewrite" → polished version | "summarize" → key points | "shorter" → condensed | "professional" → formal | "casual" → relaxed | "translate to X" → translated | "explain" → explanation | "bullet points" → list | "fix grammar" → grammar only

BAD: "Short, polished, and visually appealing. Hello, how are you..."
GOOD: "Hello, how are you..."`;

            let output = await callGemini(systemPrompt, userPrompt, { temperature: 0.25, maxTokens: 1500 });

            return {
                success: true,
                output,
                intent: detectIntent(correctedText).intent,
            };
        } else {
            // No selection — process voice input directly
            // Strip "give me a prompt to/for X" → just execute X directly
            userPrompt = correctedText
                .replace(/^(?:give\s+me\s+)?(?:a\s+)?(?:full\s+|detailed\s+)?prompt\s+(?:to|for|that)\s+/i, '')
                .replace(/^(?:create|write|generate|make)\s+(?:a|an|me\s+a)\s+(?:full\s+|detailed\s+)?prompt\s+(?:to|for|that)\s+/i, '')
                .trim() || correctedText;
            if (userPrompt !== correctedText) {
                console.log(`[AI] Meta-prompt stripped: "${correctedText.substring(0, 50)}" → "${userPrompt.substring(0, 50)}"`);
            }
        }

        // Call AI — hard cap 1500 tokens.
        console.log(`[AI] Mode: ai, maxTokens: 1500`);
        const output = await callGemini(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 1500 });

        // Bad response detection — reject meta/analysis outputs
        if (isBadAIResponse(output)) {
            return {
                success: false,
                output: '',
                error: 'bad_response',
            };
        }

        // Check if AI returned a JSON trigger (unable to fulfill request)
        const trimmed = output.trim();
        if (trimmed.startsWith('{"trigger":') || trimmed.startsWith('{"trigger" :')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.trigger === true && parsed.message) {
                    return {
                        success: false,
                        output: '',
                        error: `bad_response:${parsed.message}`,
                    };
                }
            } catch {
                // Not valid JSON, treat as normal output
            }
        }

        return {
            success: true,
            output,
            intent: detectIntent(correctedText).intent,
        };

    } catch (error) {
        return {
            success: false,
            output: '',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Process Grammar Mode (F8) request
 */
async function processGrammarMode(request: AIRequest): Promise<AIResponse> {
    try {
        const translateTo = getSetting('translateTo') || 'English';
        const inputLanguage = getSetting('inputLanguage') || 'Auto';

        // ---- Auto-select writing style based on active app ----
        const writingStyleRaw = getSetting('writingStyle') || 'formal';
        const APP_TYPE_TO_STYLE: Record<string, string> = {
            'chat': 'personal',
            'email': 'email',
            'code': 'work',
            'terminal': 'work',
            'browser': 'other',
            'document': 'other',
            'notes': 'other',
            'other': 'other',
        };
        const styleCategory = APP_TYPE_TO_STYLE[request.appContext.appType] || 'other';

        let activeStyle = 'formal';
        try {
            const parsed = JSON.parse(writingStyleRaw);
            activeStyle = parsed[styleCategory] || parsed.other || 'formal';
            console.log(`[Grammar Style] App: ${request.appContext.appName} (${request.appContext.appType}) → Category: ${styleCategory} → Style: ${activeStyle}`);
        } catch {
            activeStyle = writingStyleRaw;
        }

        let styleInstruction = '';
        if (activeStyle === 'formal' || activeStyle === 'professional') {
            styleInstruction = 'Apply a formal, structured tone. Use proper grammar, full punctuation, and well-organized sentences.';
        } else if (activeStyle === 'casual') {
            styleInstruction = 'Apply a friendly, conversational tone. Use natural contractions and relaxed punctuation. Keep it natural like talking to a friend.';
        } else if (activeStyle === 'relaxed' || activeStyle === 'freetype') {
            styleInstruction = 'Minimal corrections only. No restructuring, no added punctuation beyond basics. Keep the raw feel of what the user said.';
        }

        let systemPrompt = getGrammarModeSystemPrompt();

        // Add writing style instruction
        if (styleInstruction) {
            systemPrompt += `\n\nWRITING STYLE: ${styleInstruction}`;
        }

        // Add translation instruction if output language differs
        // 'Auto' = keep same language as input, no translation
        if (translateTo === 'Auto') {
            systemPrompt += `\n\nADDITIONAL RULE: Respond in the SAME language as the input. Do NOT translate. Just fix grammar and return the corrected text in the original language.`;
        } else if (translateTo !== 'English' || (inputLanguage !== 'Auto' && inputLanguage !== translateTo)) {
            systemPrompt += `\n\nADDITIONAL RULE: After fixing grammar, translate the output to ${translateTo}. Return ONLY the translated, corrected text.`;
        }

        // Use selected text if available, otherwise use transcript
        let textToFix = request.selectedText?.trim() || request.transcript;

        // Apply dictionary corrections first
        textToFix = applyDictionaryCorrections(textToFix);

        // Replace snippets in text
        const { result: snippetReplacedText } = replaceSnippetsInText(textToFix);
        textToFix = snippetReplacedText;

        // Call AI — Grammar mode: no cap, clean however much the user spoke
        console.log(`[Grammar] Input: ${textToFix.split(' ').length} words → uncapped`);
        const output = await callGemini(systemPrompt, textToFix, { temperature: 0.1, maxTokens: 1500 });

        // Bad response detection — reject meta/analysis outputs
        if (isBadAIResponse(output)) {
            return {
                success: false,
                output: '',
                error: 'bad_response',
            };
        }

        // Check if AI returned a JSON trigger (unable to fulfill request)
        const grammarTrimmed = output.trim();
        if (grammarTrimmed.startsWith('{"trigger":') || grammarTrimmed.startsWith('{"trigger" :')) {
            try {
                const parsed = JSON.parse(grammarTrimmed);
                if (parsed.trigger === true && parsed.message) {
                    return {
                        success: false,
                        output: '',
                        error: `bad_response:${parsed.message}`,
                    };
                }
            } catch {
                // Not valid JSON, treat as normal output
            }
        }

        return {
            success: true,
            output,
            intent: 'grammar',
        };

    } catch (error) {
        return {
            success: false,
            output: '',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Main processing function
 */
export async function processVoiceInput(
    transcript: string,
    mode: 'ai' | 'grammar',
    appContext: AppContext,
    selectedText?: string
): Promise<AIResponse> {
    const request: AIRequest = {
        transcript,
        selectedText,
        mode,
        appContext,
    };

    console.log(`[AI] Processing ${mode.toUpperCase()} mode`);
    console.log(`[AI] Transcript: "${transcript.substring(0, 100)}"`);
    console.log(`[AI] App: ${appContext.appName} (${appContext.appType})`);
    if (selectedText) {
        console.log(`[AI] Selected: "${selectedText.substring(0, 50)}..."`);
    }

    if (mode === 'grammar') {
        return processGrammarMode(request);
    } else {
        return processAIMode(request);
    }
}

/**
 * Generate email from voice command
 */
export async function generateEmail(
    instruction: string,
    recipientName?: string,
    appContext?: AppContext
): Promise<{ to: string; subject: string; body: string } | null> {
    try {
        const systemPrompt = `You are Juskoe's email composer.

Generate a professional email from the voice instruction.
NO placeholder brackets. Use realistic names or leave blank.
Output ONLY valid JSON:

{"to":"recipient","subject":"subject line","body":"email body"}

No markdown. No explanations. Return ONLY the JSON.`;

        const userPrompt = recipientName
            ? `Email to ${recipientName}: ${instruction} `
            : instruction;

        const response = await callGemini(systemPrompt, userPrompt);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return null;
    } catch (error) {
        console.error('[AI] Email generation error:', error);
        return null;
    }
}

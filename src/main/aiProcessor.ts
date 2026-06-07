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
// OpenRouter API keys loaded from environment
// Set OPENROUTER_KEYS as comma-separated list in .env
const OPENROUTER_KEYS: string[] = (process.env.OPENROUTER_KEYS || '').split(',').filter(k => k.trim().length > 0);
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
 * F7 - AI Mode System Prompt (Full Juskoe AI Assistant)
 */
function getAIModeSystemPrompt(appContext: AppContext, userStyle?: { prompt: string; language: string }): string {
    const outputLanguage = userStyle?.language || 'English';
    const customRole = userStyle?.prompt || '';

    // Gather user's snippets and dictionary for AI context
    const allSnippets = getAllSnippets();
    const snippetContext = allSnippets.length > 0
        ? allSnippets.map(s => `  "${s.key}" (${s.title}) → "${s.content.substring(0, 80)}${s.content.length > 80 ? '...' : ''}"`).join('\n')
        : '';

    // Get dictionary words for AI context
    let dictionaryContext = '';
    const dictWords = getAllDictionaryWords();
    if (dictWords.length > 0) {
        dictionaryContext = dictWords.map(d => `  "${d.word}" → "${d.corrections[0]}"`).join('\n');
    }

    const isAutoLang = outputLanguage === 'Auto';
    const langRule = isAutoLang
        ? '- IMPORTANT: Respond in the SAME language as the input. If the user speaks Tamil, respond in Tamil. If English, respond in English. Do NOT translate to a different language.'
        : `- IMPORTANT: If the input is in a different language, TRANSLATE it on-the-fly to ${outputLanguage} while processing. The final output MUST be in ${outputLanguage}.`;

    return `You are Juskoe AI — a silent, expert engine embedded in a voice-to-text productivity app. The user spoke a request via microphone. You output paste-ready text IMMEDIATELY.

ABSOLUTE RULES — NEVER BREAK THESE:
1. NEVER ask any question back. Not "What is this about?", not "Could you clarify?" — NEVER.
2. NEVER say opening fillers like "Sure", "Of course", "I'd be happy to", "Great!", "Here is...".
3. NEVER explain what you are doing or what you changed. Just do it.
4. NEVER ask for missing info — fill in smart defaults silently.
5. NEVER stop mid-answer. Always produce a complete, finished result.
6. NEVER use markdown code fences (\`\`\`). For code-related asks, describe approach + key files + commands in plain prose.
7. If a letter/email needs a name and none is given → use "Dear Sir/Madam" and sign "[Your Name]".
8. Output ONLY the final result. The very first character must be the result itself.

INTERPRETING "give me a prompt to X" REQUESTS:
The user is dictating into the app, so phrases like "give me a prompt to build X" or "create a prompt for X" mean they want X DONE, not a meta-prompt for another AI.
→ Skip the word "prompt" — DO X yourself, completely, right now.
Example: "give me a prompt to build an ecommerce website" → produce the full ecommerce website plan/guide directly.

OUTPUT LENGTH — MUST MATCH THE REQUEST:
- One-line message / quick reply / yes-no answer → 1–3 sentences, naturally short.
- Email / letter / formal note → full document, 200–600 words.
- Plan / guide / how-to / roadmap / strategy → structured with sections + bullets, 600–1500 words.
- Explanation / summary / breakdown → clear and complete, 400–1200 words.
- Code/tech approach → architecture + steps + commands in prose, 500–1500 words.
- Rewrite / improve → similar length to input, polished version.
- For ANY substantial request, produce AT LEAST 300 words. Do NOT cut off at 40-50 words unless the request is genuinely a one-liner.
- Hard cap: 1500 words. Stop cleanly at a paragraph boundary before the cap.
- NEVER truncate mid-sentence.

CONTEXT (use these silently — do NOT mention them in output):
- App: ${appContext.appName} (${appContext.appType})
- Tone: ${appContext.suggestedTone}
- Output language: ${isAutoLang ? 'same as user input' : outputLanguage}${customRole ? `\n- Active style/role: ${customRole}` : ''}
${snippetContext ? `- User snippets (only inline if user explicitly says "add/insert/use/paste/my <key>"):\n${snippetContext}\n` : ''}${dictionaryContext ? `- User dictionary (proper-noun spellings to preserve):\n${dictionaryContext}\n` : ''}
${langRule}

FORMATTING:
- Use ## for section headings when the output has clear sections.
- Use • or numbered steps for lists.
- Plain readable prose. No code fences. No "Note:" or "Disclaimer:" suffixes.

Output the result directly. Nothing else.`;
}

/**
 * F8/F9 - Voice Dictation Cleaner
 * Strips pure speech garbage, keeps message content, fixes grammar.
 */
function getGrammarModeSystemPrompt(): string {
    return `You are a speech-to-text cleaner. Your job: remove vocal garbage, keep the message, fix grammar. Output ONE clean result only.

REMOVE these — they are pure speech sounds, not part of any message:
• Hesitation sounds: "um", "uh", "uhh", "umm", "uhmm", "hmm", "ahh", "err", "like um"
• Stretching/elongated sounds: "waitttttt", "sooooo", "okaaaay" — clean to normal word
• Restart phrases: "no wait", "no no", "sorry sorry", "let me start again", "scratch that"
• False starts: if speaker starts a sentence then immediately corrects: "The pro— I mean the main file" → "The main file"

KEEP these — they are part of the message, just written casually:
• "idk" "omg" "lol" "brb" "btw" "imo" "tbh" — keep them if they fit the sentence
• All technical words, names, code terms — preserve exactly
• Casual phrases like "that is closing" or "I don't know what" — preserve if they make sense as part of the message
• Questions, instructions, any actual content

AFTER cleaning:
1. Fix spelling, grammar, punctuation, capitalization
2. Lists/steps → numbered (1. 2. 3.) or bullets (•)
3. Single thought → one paragraph

OUTPUT FORMAT — STRICT:
• One result only. No "Option 1", no "Balanced output", no alternatives
• No explanation of what you changed
• No headers, no commentary
• Just the cleaned text

EXAMPLES:
Input:  "Umm so uhh I wanted to say idk maybe we should meet tomorrow?"
Output: "I wanted to say, idk, maybe we should meet tomorrow?"

Input:  "That is closing immediately. I don't know what. Please save whatever you want to save as soon as possible."
Output: "That is closing immediately. I don't know what. Please save whatever you want to save as soon as possible."

Input:  "The pro— no wait the main file umm has a critical issue with the uh e-commerce site"
Output: "The main file has a critical issue with the e-commerce site."

Input:  "omg waitttttt I forgot to send the report to sooooo many people"
Output: "OMG wait, I forgot to send the report to so many people."

Return ONLY the cleaned text.`;
}

// ============================================
// Notes Mode Processing (F9)
// Clean STT noise + format + save to notes
// ============================================

const NOTES_SYSTEM_PROMPT = `You are a voice note formatter. The user spoke a note aloud. Your job:
1. Remove all vocal garbage: "um", "uh", "uhh", "umm", "hmm", "ahh", "err", "no wait", "sorry", false starts
2. Fix spelling, grammar, capitalization, punctuation
3. Format intelligently:
   - If it's a list of items/tasks/steps → use • bullet points, one per line
   - If it's a single idea/thought → one clean paragraph
   - If it's a to-do/reminder → start with the action word ("Buy...", "Call...", "Fix...")
4. Keep the speaker's exact meaning and casual words (idk, omg, etc.) if part of the note

RULES:
- Output ONLY the formatted note text
- No labels, no "Note:", no headers, no commentary
- Do NOT add content that wasn't said`;

export async function processNotesMode(transcript: string): Promise<{ success: boolean; text: string; error?: string }> {
    try {
        // Apply dictionary corrections first
        let cleaned = applyDictionaryCorrections(transcript);

        // Call AI to clean + format — no cap, output as much as the user spoke
        console.log(`[Notes] Input: ${cleaned.split(' ').length} words → uncapped`);
        const formatted = await callGemini(NOTES_SYSTEM_PROMPT, cleaned, { temperature: 0.1, maxTokens: 1500 });
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
        'HTTP-Referer': 'https://juskoe.com',
        'X-Title': 'Juskoe',
    });

    // Try each key in order — move to next only on auth/rate errors
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
            userPrompt = `Apply the user's voice instruction to the selected text below.

SELECTED TEXT:
${request.selectedText}

VOICE INSTRUCTION: "${correctedText}"

RULES:
- Output ONLY the result text. Nothing else.
- Do NOT start with a label like "Here is the rewritten text:" or "Short, polished, and visually appealing." or any description.
- Do NOT explain what you changed. Do NOT rate the output. Do NOT add headers.
- The very first character of your output must be the result itself.
- If instruction is empty or unclear, default to: rewrite the text to be cleaner and more professional.
- If selected text is raw STT (messy speech), clean it up as part of the operation.
- Intents: "rewrite/improve" → cleaner version | "summarize" → key points | "shorter" → condensed | "professional/formal" → formal tone | "casual" → relaxed tone | "translate to X" → translated | "explain" → clear explanation | "bullet points" → list format | "fix grammar" → grammar only

BAD OUTPUT EXAMPLE (never do this):
Short, polished, and visually appealing.
Hello, how are you...

GOOD OUTPUT EXAMPLE:
Hello, how are you...`;

            let output = await callGemini(systemPrompt, userPrompt, { temperature: 0.25, maxTokens: 1500 });

            // Strip any leading label the model adds (e.g. "Short, polished:\n" or "Here is the result:\n")
            // A label is: a single short line (< 80 chars) ending with . or : followed by a newline
            output = output.replace(/^[^\n]{3,80}[.:]\n+/, '').trim();

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

Generate a professional email based on the voice instruction.
NEVER use placeholder brackets like[Your Name]or[Date].
Use realistic names or leave blank if not provided.

OUTPUT FORMAT(JSON only):
{
    "to": "recipient",
        "subject": "subject line",
            "body": "email body"
}

Return ONLY valid JSON.No markdown.No explanations.`;

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

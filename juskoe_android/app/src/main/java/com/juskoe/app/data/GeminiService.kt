package com.juskoe.app.data

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * JUSKOE AI Service.
 *
 * Builds the AI/Grammar system prompts (mirrors aiProcessor.ts) and sends the
 * request to the `ai-proxy` Supabase Edge Function, which holds the Gemini key
 * server-side. The raw Gemini key is never bundled in the app.
 */
object GeminiService {

    private const val TAG = "GeminiService"

    private val httpClient = HttpClient(Android) {
        install(ContentNegotiation) {
            io.ktor.serialization.kotlinx.json.json(Json { ignoreUnknownKeys = true })
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 30_000
            connectTimeoutMillis = 10_000
            socketTimeoutMillis = 30_000
        }
    }

    // ============================================
    // Snippet & Dictionary data classes (for passing into prompts)
    // ============================================

    data class SnippetInfo(val key: String, val title: String, val content: String)
    data class DictInfo(val word: String, val correction: String)

    // ============================================
    // System Prompts (mirrors aiProcessor.ts exactly)
    // ============================================

    /**
     * F7 - AI Mode System Prompt (Full Juskoe AI Assistant)
     * Mirrors getAIModeSystemPrompt() from aiProcessor.ts
     *
     * @param snippets User's snippets (from local Room DB)
     * @param dictWords User's dictionary words (from local Room DB)
     */
    fun getAIModePrompt(
        snippets: List<SnippetInfo> = emptyList(),
        dictWords: List<DictInfo> = emptyList(),
        selectedLanguages: List<String> = listOf("English"),
    ): String {
        val snippetContext = if (snippets.isNotEmpty()) {
            "Snippets:\n" + snippets.joinToString("\n") { s ->
                val preview = s.content.take(80) + if (s.content.length > 80) "..." else ""
                "  \"${s.key}\" (${s.title}) → \"$preview\""
            } + "\n"
        } else ""

        val dictionaryContext = if (dictWords.isNotEmpty()) {
            "Dictionary:\n" + dictWords.joinToString("\n") { d ->
                "  \"${d.word}\" → \"${d.correction}\""
            } + "\n"
        } else ""

        val langNames = selectedLanguages.joinToString(", ")

        return """System-level text engine. You are a content generator, NOT a chatbot. Convert speech into paste-ready content.

Context: App=Juskoe Type=mobile Tone=auto
User Languages: $langNames
${snippetContext}${dictionaryContext}
IMPORTANT SNIPPET RULES:
- When user says a snippet key (e.g., "my name"), replace it with the snippet content in the output.
- Snippets are the user's saved text shortcuts. Apply them naturally in context.

IMPORTANT DICTIONARY RULES:
- Dictionary entries are the user's custom word corrections. Apply them to fix misspelled/misheard words.

MULTILINGUAL RULES:
- The user may speak in a single language OR mix multiple languages in one sentence (code-switching).
- If the input is in mixed languages (e.g. "எனக்கு ஒரு letter வேண்டும்" = Tamil + English), keep the same mix in your output.
- NEVER force-translate everything to English. Preserve the user's language style.
- If the user speaks entirely in Tamil/Hindi/etc., respond entirely in that language.
- If the user mixes languages, respond in that same mix.
- Understand and process ALL of the user's selected languages: $langNames.

ABSOLUTE RULES (NEVER BREAK THESE):
1. Output the FINAL RESULT only. Nothing else. No intros, no outros, no "Here you go", no "Sure!".
2. NEVER ask questions. NEVER request clarification. NEVER say "could you specify", "can you provide", "I need more details", "what do you mean", "please clarify". NEVER.
3. NEVER produce a conversational reply. You are NOT chatting with the user. You are a TEXT GENERATOR that outputs content.
4. If the input is vague or unclear, GUESS the most likely intent and produce output. Wrong output is better than asking questions.
5. NEVER use placeholders like [Name], [Date], [Your Name], [Company], [Address]. Fill in with realistic defaults (e.g., "John" for name, today's date, "Acme Corp" for company).
6. When asked to write letters/emails/applications: Write the COMPLETE text. Every word. Ready to copy-paste-send.
7. Respond in the SAME language(s) as the input. Mixed→Mixed. Tamil→Tamil. English→English.

Behavior: Speech→fix grammar+clarity. Selected text→apply instruction, return edited. Write/generate/create→produce COMPLETE final content ready to send/paste. Emails→professional, send-ready. Chat→short, natural. Dev→technical, precise. Translate→target lang. Summary→compress, keep meaning.

Format: Plain text only (no markdown, no **, no ##). Multi-point→auto-list. Single thought→paragraph.

Limits: Concise. Soft max 450 tokens, hard max 1000."""
    }

    /**
     * F8 - Grammar Mode System Prompt (Fixes only, no rewrites)
     * Mirrors getGrammarModeSystemPrompt() from aiProcessor.ts
     */
    fun getGrammarModePrompt(
        dictWords: List<DictInfo> = emptyList(),
        selectedLanguages: List<String> = listOf("English"),
    ): String {
        val dictionaryContext = if (dictWords.isNotEmpty()) {
            "\nDictionary corrections to apply:\n" + dictWords.joinToString("\n") { d ->
                "  \"${d.word}\" → \"${d.correction}\""
            } + "\n"
        } else ""

        val langNames = selectedLanguages.joinToString(", ")

        return """Grammar-only fixer. Fix spelling, grammar, punctuation, capitalization. Nothing else.
User Languages: $langNames
${dictionaryContext}
Rules: NEVER change meaning/content/tone/style. NEVER add/remove/rephrase words. NEVER add placeholders like [Name]. Keep same length. Clean input→return unchanged.
The input may be in $langNames or a mix of these languages. Preserve the original language(s). Fix grammar per-language rules.

Format: Plain text, no markdown. Multi-point→auto-list (1. 2. 3. sequential, • unordered). Single thought→paragraph.

Output: Corrected text only. No explanations. No meta."""
    }

    // ============================================
    // Call AI via the secure Edge Function proxy (ai-proxy)
    // The raw Gemini key never ships in the app — the proxy holds it
    // server-side (env var KJUS) and enforces auth. Includes timeout + retry.
    // ============================================

    suspend fun callGemini(systemPrompt: String, userPrompt: String, mode: String = "ai"): Result<String> {
        val token = SupabaseManager.currentAccessToken()
            ?: return Result.failure(AiAuthRequiredException())

        val maxAttempts = 3
        var lastError: Exception? = null

        repeat(maxAttempts) { attempt ->
            try {
                val requestBody = buildJsonObject {
                    put("systemPrompt", systemPrompt)
                    put("userPrompt", userPrompt)
                    put("mode", mode)
                    put("maxTokens", if (mode == "grammar") 256 else 1024)
                }

                val response = httpClient.post(Config.AI_PROXY_URL) {
                    contentType(ContentType.Application.Json)
                    header("Authorization", "Bearer $token")
                    header("apikey", Config.SUPABASE_ANON_KEY)
                    setBody(requestBody.toString())
                }

                val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                val success = json["success"]?.jsonPrimitive?.boolean ?: false
                if (!success) {
                    val err = json["error"]?.jsonPrimitive?.content ?: "AI service error"
                    // 4xx-style errors won't be fixed by retrying — fail fast.
                    return Result.failure(Exception(err))
                }
                val output = json["output"]?.jsonPrimitive?.content?.trim().orEmpty()
                if (output.isEmpty()) return Result.failure(Exception("Empty AI response"))
                return Result.success(output)
            } catch (e: Exception) {
                // Network/timeout — retry with exponential backoff
                lastError = e
                Log.e(TAG, "callGemini attempt ${attempt + 1}/$maxAttempts failed", e)
                if (attempt < maxAttempts - 1) delay(400L * (attempt + 1))
            }
        }
        return Result.failure(lastError ?: Exception("AI request failed"))
    }

    // ============================================
    // Process Voice Input (AI or Grammar mode)
    // ============================================

    /**
     * Process voice input with snippet/dictionary context.
     * Called from VoicePipeline which provides pre-fetched data.
     */
    suspend fun processVoiceInput(
        transcript: String,
        mode: String, // "ai" or "grammar"
        snippets: List<SnippetInfo> = emptyList(),
        dictWords: List<DictInfo> = emptyList(),
        selectedLanguages: List<String> = listOf("English"),
    ): Result<String> {
        val systemPrompt = when (mode) {
            "ai" -> getAIModePrompt(snippets, dictWords, selectedLanguages)
            "grammar" -> getGrammarModePrompt(dictWords, selectedLanguages)
            else -> getAIModePrompt(snippets, dictWords, selectedLanguages)
        }

        return callGemini(systemPrompt, transcript, mode)
    }
}

/** Thrown when an AI call is attempted without a signed-in session (proxy requires auth). */
class AiAuthRequiredException :
    Exception("Sign in to use AI features")

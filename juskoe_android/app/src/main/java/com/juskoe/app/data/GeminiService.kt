package com.juskoe.app.data

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * JUSKOE Gemini API Service
 * Mirrors aiProcessor.ts — calls Gemini directly via REST API
 * Same prompts, same model (gemini-2.5-flash-lite)
 *
 * KEY DIFFERENCE FROM PREVIOUS VERSION:
 * - No more runBlocking — snippets/dict are passed as parameters
 * - Caller (VoicePipeline) fetches snippets/dict from local Room DB
 */
object GeminiService {

    private const val TAG = "GeminiService"

    private val httpClient = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
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
    // Call Gemini API
    // ============================================

    suspend fun callGemini(systemPrompt: String, userPrompt: String): Result<String> {
        return try {
            val url = "${Config.GEMINI_API_URL}/${Config.GEMINI_MODEL}:generateContent?key=${Config.GEMINI_API_KEY}"

            val requestBody = buildJsonObject {
                put("contents", buildJsonArray {
                    add(buildJsonObject {
                        put("role", "user")
                        put("parts", buildJsonArray {
                            add(buildJsonObject { put("text", userPrompt) })
                        })
                    })
                })
                put("systemInstruction", buildJsonObject {
                    put("parts", buildJsonArray {
                        add(buildJsonObject { put("text", systemPrompt) })
                    })
                })
                put("generationConfig", buildJsonObject {
                    put("maxOutputTokens", 1000)
                    put("temperature", 0.3)
                })
            }

            val response = httpClient.post(url) {
                contentType(ContentType.Application.Json)
                setBody(requestBody.toString())
            }

            val body = response.bodyAsText()
            val json = Json.parseToJsonElement(body).jsonObject

            // Extract text from Gemini response
            val text = json["candidates"]
                ?.jsonArray?.firstOrNull()
                ?.jsonObject?.get("content")
                ?.jsonObject?.get("parts")
                ?.jsonArray?.firstOrNull()
                ?.jsonObject?.get("text")
                ?.jsonPrimitive?.content
                ?: throw Exception("No text in Gemini response")

            Result.success(text.trim())
        } catch (e: Exception) {
            Log.e(TAG, "callGemini failed", e)
            Result.failure(e)
        }
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

        return callGemini(systemPrompt, transcript)
    }
}

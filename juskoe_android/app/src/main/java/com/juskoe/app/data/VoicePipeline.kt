package com.juskoe.app.data

import android.content.Context
import android.util.Log
import com.juskoe.app.data.local.JuskoeDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * JUSKOE Voice Pipeline — full processing chain
 * Mirrors the Electron app pipeline:
 * 1. Check credits (pre-recording for free plan)
 * 2. Record audio (PCM 16kHz mono)
 * 3. STT via Sherpa-ONNX Whisper Tiny.en INT8 (on-device, <3s for 5s audio)
 * 4. **Pre-process transcript** (dictionary corrections + snippet replacements)
 * 5. Process via Gemini (AI or Grammar mode) with snippet/dict context
 * 6. Increment usage (fire-and-forget)
 * 7. Return processed text
 */
class VoicePipeline(private val context: Context) {

    companion object {
        private const val TAG = "VoicePipeline"
    }

    private val audioRecorder = AudioRecorder(context)
    private var sherpaSTT: SherpaSTT? = null

    /**
     * Initialize or re-initialize the STT engine if the language changed.
     * Call from a background thread — model loading takes ~2-5s.
     */
    fun initSTT(): Boolean {
        // Check if user's selected language differs from what's loaded
        val selectedLangs = SherpaSTT.getSelectedLanguages(context)
        // Match SherpaSTT logic: 1 lang = force it, multiple = auto-detect (empty string)
        val wantLang = if (selectedLangs.size == 1) selectedLangs.first() else ""

        if (sherpaSTT != null) {
            // Already loaded — but check if the language changed
            if (sherpaSTT!!.currentLanguage == wantLang) return true
            // Language changed — release old and reload
            Log.d(TAG, "Language changed from ${sherpaSTT!!.currentLanguage} to $wantLang, reinitializing STT...")
            sherpaSTT!!.release()
            sherpaSTT = null
        }

        return try {
            Log.d(TAG, "Initializing Sherpa-ONNX STT (lang=$wantLang)...")
            val stt = SherpaSTT(context)
            val ok = stt.initialize()
            if (ok) {
                sherpaSTT = stt
                Log.d(TAG, "STT initialized successfully (lang=$wantLang)")
            } else {
                Log.e(TAG, "STT initialization returned false")
            }
            ok
        } catch (e: Exception) {
            Log.e(TAG, "STT initialization failed", e)
            false
        }
    }

    // ============================================
    // Credit Check (pre-recording)
    // ============================================

    /**
     * Check if user has credits remaining before recording.
     * Mirrors main.ts lines 618-649
     */
    suspend fun checkCreditsBeforeRecording(mode: String): CreditCheckResult {
        // Not logged in → allow (anonymous usage)
        if (!SupabaseManager.isAuthenticated()) {
            return CreditCheckResult(allowed = true)
        }

        return try {
            // Pro users bypass all limits
            val profile = SupabaseManager.getProfile()
            if (profile?.plan == "pro") {
                return CreditCheckResult(allowed = true)
            }

            val usage = SupabaseManager.getUsageSummary()

            // RPC-level check (server may already deny)
            if (usage.limitReached) {
                return CreditCheckResult(allowed = false, reason = "Daily limit reached")
            }

            val blocked = when (mode) {
                "ai" -> usage.dailyAI >= Config.FreePlan.DAILY_AI
                "grammar" -> usage.dailyGrammar >= Config.FreePlan.DAILY_GRAMMAR
                "notes" -> false // Notes don't consume credits
                else -> false
            } || usage.monthlyTotal >= Config.FreePlan.MONTHLY_TOTAL

            if (blocked) {
                val reason = when {
                    mode == "ai" && usage.dailyAI >= Config.FreePlan.DAILY_AI ->
                        "AI credits exhausted (${usage.dailyAI}/${Config.FreePlan.DAILY_AI} today)"
                    mode == "grammar" && usage.dailyGrammar >= Config.FreePlan.DAILY_GRAMMAR ->
                        "Grammar credits exhausted (${usage.dailyGrammar}/${Config.FreePlan.DAILY_GRAMMAR} today)"
                    usage.monthlyTotal >= Config.FreePlan.MONTHLY_TOTAL ->
                        "Monthly limit reached (${usage.monthlyTotal}/${Config.FreePlan.MONTHLY_TOTAL})"
                    else -> "Credits exhausted"
                }
                CreditCheckResult(allowed = false, reason = reason)
            } else {
                CreditCheckResult(allowed = true)
            }
        } catch (e: Exception) {
            // Fail-open: if check fails, allow recording
            CreditCheckResult(allowed = true)
        }
    }

    // ============================================
    // Transcript Pre-Processing (mirrors desktop aiProcessor.ts)
    // ============================================

    /**
     * Load snippets + dictionary from local Room DB.
     * Fast and offline-friendly — no network calls.
     */
    private suspend fun loadLocalContext(): Pair<List<GeminiService.SnippetInfo>, List<GeminiService.DictInfo>> {
        return try {
            val db = JuskoeDatabase.getInstance(context)
            val snippets = db.snippetDao().getAllOnce().map { s ->
                GeminiService.SnippetInfo(key = s.key, title = s.title, content = s.content)
            }
            val dictWords = db.dictDao().getAllOnce().map { d ->
                GeminiService.DictInfo(word = d.word, correction = d.correction)
            }
            Log.d(TAG, "Loaded ${snippets.size} snippets, ${dictWords.size} dict words from local DB")
            Pair(snippets, dictWords)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load local context", e)
            Pair(emptyList(), emptyList())
        }
    }

    /**
     * Apply dictionary corrections to transcript.
     * Mirrors applyDictionaryCorrections() from desktop localStorage.ts
     *
     * For each dict entry (word → correction), replaces occurrences
     * in the transcript using case-insensitive word boundary matching.
     */
    private fun applyDictCorrections(
        text: String,
        dictWords: List<GeminiService.DictInfo>,
    ): String {
        if (dictWords.isEmpty()) return text
        var result = text
        for (d in dictWords) {
            try {
                val pattern = Regex("\\b${Regex.escape(d.word)}\\b", RegexOption.IGNORE_CASE)
                val before = result
                result = pattern.replace(result, d.correction)
                if (result != before) {
                    Log.d(TAG, "[Dict] Corrected: \"${d.word}\" → \"${d.correction}\"")
                }
            } catch (_: Exception) { /* skip bad regex patterns */ }
        }
        return result
    }

    /**
     * Replace snippet triggers in transcript with their content.
     * Mirrors replaceSnippetsInText() from desktop aiProcessor.ts
     *
     * Checks for patterns like "my name", "add my name", "insert my address"
     * and replaces them with the snippet content.
     */
    private fun replaceSnippetTriggers(
        text: String,
        snippets: List<GeminiService.SnippetInfo>,
    ): String {
        if (snippets.isEmpty()) return text
        var result = text
        for (s in snippets) {
            try {
                // Match: "my <key>", "add <key>", "insert <key>", or just "<key>"
                val patterns = listOf(
                    Regex("\\b(?:add|insert|use|my)?\\s*${Regex.escape(s.key)}\\b", RegexOption.IGNORE_CASE),
                    Regex("\\b${Regex.escape(s.title)}\\b", RegexOption.IGNORE_CASE),
                )
                for (pattern in patterns) {
                    val before = result
                    result = pattern.replace(result, s.content)
                    if (result != before) {
                        Log.d(TAG, "[Snippet] Replaced \"${s.key}\" with \"${s.content.take(30)}...\"")
                    }
                }
            } catch (_: Exception) { /* skip bad patterns */ }
        }
        return result
    }

    /**
     * Full transcript pre-processing pipeline.
     * Mirrors processTranscriptRealtime() from desktop aiProcessor.ts:
     * 1. Apply dictionary corrections
     * 2. Replace snippet triggers
     */
    private fun preprocessTranscript(
        transcript: String,
        snippets: List<GeminiService.SnippetInfo>,
        dictWords: List<GeminiService.DictInfo>,
    ): String {
        // Step 1: Dictionary corrections
        var processed = applyDictCorrections(transcript, dictWords)

        // Step 2: Snippet replacements
        processed = replaceSnippetTriggers(processed, snippets)

        if (processed != transcript) {
            Log.d(TAG, "Transcript pre-processed: \"${transcript.take(50)}\" → \"${processed.take(50)}\"")
        }
        return processed
    }

    // ============================================
    // Full Pipeline
    // ============================================

    /**
     * Process a voice recording through the full pipeline.
     * Returns processed text or error.
     */
    suspend fun processRecording(
        pcmData: ByteArray,
        mode: String, // "ai" or "grammar"
    ): PipelineResult = withContext(Dispatchers.IO) {
        try {
            val pipelineStartMs = System.currentTimeMillis()

            // Step 1: Load snippet + dictionary context from local DB
            val (snippets, dictWords) = loadLocalContext()

            // Step 2: STT — on-device Whisper Tiny via Sherpa-ONNX
            val sttStart = System.currentTimeMillis()
            val rawTranscript = runSTT(pcmData)
            val sttMs = System.currentTimeMillis() - sttStart
            Log.d(TAG, "Pipeline STT took ${sttMs}ms")

            if (rawTranscript.isBlank()) {
                Log.e("JUSKOE", "ERROR_STAGE=STT ERROR_MESSAGE=No speech detected (blank transcript, sttMs=$sttMs)")
                return@withContext PipelineResult(
                    success = false,
                    error = "No speech detected",
                )
            }

            // Filter hallucinations (same as Electron app)
            val hallucinationPatterns = listOf(
                "thank you", "thanks for watching", "please subscribe",
                "bye", "see you", "you",
            )
            if (rawTranscript.lowercase().trim() in hallucinationPatterns) {
                Log.e("JUSKOE", "ERROR_STAGE=STT ERROR_MESSAGE=Noise filtered (\"$rawTranscript\")")
                return@withContext PipelineResult(
                    success = false,
                    error = "Noise filtered",
                )
            }

            // Step 3: Pre-process transcript (dict corrections + snippet replacements)
            val transcript = preprocessTranscript(rawTranscript, snippets, dictWords)
            Log.d("JUSKOE", "TEXT_CAPTURED: \"$transcript\" (mode=$mode)")

            // Step 4: Gemini Processing (with snippet/dict context in system prompt)
            val selectedLangNames = SherpaSTT.getSelectedLanguages(context).map { code ->
                SherpaSTT.SUPPORTED_LANGUAGES.firstOrNull { it.first == code }?.second ?: code
            }
            val geminiStart = System.currentTimeMillis()
            val processedResult = GeminiService.processVoiceInput(
                transcript = transcript,
                mode = mode,
                snippets = snippets,
                dictWords = dictWords,
                selectedLanguages = selectedLangNames,
            )
            val geminiMs = System.currentTimeMillis() - geminiStart
            Log.d(TAG, "Pipeline Gemini took ${geminiMs}ms")

            if (processedResult.isFailure) {
                val em = processedResult.exceptionOrNull()?.message ?: "AI processing failed"
                Log.e("JUSKOE", "ERROR_STAGE=GEMINI ERROR_MESSAGE=$em")
                return@withContext PipelineResult(
                    success = false,
                    transcript = transcript,
                    error = em,
                )
            }

            val output = processedResult.getOrThrow()

            // Step 5: Increment usage (fire-and-forget, never block pipeline)
            CoroutineScope(Dispatchers.IO).launch {
                try { SupabaseManager.checkAndIncrementUsage(mode) } catch (_: Exception) {}
            }

            val totalMs = System.currentTimeMillis() - pipelineStartMs
            Log.d(TAG, "Pipeline total: ${totalMs}ms (STT=${sttMs}ms, Gemini=${geminiMs}ms)")

            PipelineResult(
                success = true,
                transcript = transcript,
                processedText = output,
            )
        } catch (e: Exception) {
            Log.e("JUSKOE", "ERROR_STAGE=PIPELINE ERROR_MESSAGE=${e.message}", e)
            PipelineResult(
                success = false,
                error = e.message ?: "Pipeline error",
            )
        }
    }

    /**
     * Process a voice recording with selected text context.
     * The transcript is the instruction, selectedText is the content to transform.
     */
    suspend fun processRecordingWithContext(
        pcmData: ByteArray,
        mode: String,
        selectedText: String,
    ): PipelineResult = withContext(Dispatchers.IO) {
        try {
            // Load context
            val (snippets, dictWords) = loadLocalContext()

            val rawTranscript = runSTT(pcmData)
            if (rawTranscript.isBlank()) {
                // No speech — just process selected text directly
                val processedText = applyDictCorrections(selectedText, dictWords)
                val result = GeminiService.processVoiceInput(processedText, mode, snippets, dictWords)
                return@withContext if (result.isSuccess) {
                    CoroutineScope(Dispatchers.IO).launch {
                        try { SupabaseManager.checkAndIncrementUsage(mode) } catch (_: Exception) {}
                    }
                    PipelineResult(success = true, transcript = "", processedText = result.getOrThrow())
                } else {
                    PipelineResult(success = false, error = result.exceptionOrNull()?.message ?: "AI failed")
                }
            }

            // Pre-process transcript
            val transcript = preprocessTranscript(rawTranscript, snippets, dictWords)

            val combinedPrompt = "Selected text:\n\"\"\"$selectedText\"\"\"\n\nUser instruction: $transcript"
            Log.d(TAG, "processRecordingWithContext: prompt length=${combinedPrompt.length}")
            val selectedLangNames = SherpaSTT.getSelectedLanguages(context).map { code ->
                SherpaSTT.SUPPORTED_LANGUAGES.firstOrNull { it.first == code }?.second ?: code
            }
            val result = GeminiService.processVoiceInput(combinedPrompt, mode, snippets, dictWords, selectedLangNames)
            if (result.isFailure) {
                return@withContext PipelineResult(success = false, transcript = transcript,
                    error = result.exceptionOrNull()?.message ?: "AI processing failed")
            }
            CoroutineScope(Dispatchers.IO).launch {
                try { SupabaseManager.checkAndIncrementUsage(mode) } catch (_: Exception) {}
            }
            PipelineResult(success = true, transcript = transcript, processedText = result.getOrThrow())
        } catch (e: Exception) {
            PipelineResult(success = false, error = e.message ?: "Pipeline error")
        }
    }

    /**
     * Run STT on PCM data using Sherpa-ONNX Whisper Tiny.en.
     * Initializes the recognizer lazily if needed.
     */
    private fun runSTT(pcmData: ByteArray): String {
        // Ensure STT is initialized
        if (sherpaSTT == null) {
            initSTT()
        }
        val stt = sherpaSTT ?: return ""
        return stt.transcribe(pcmData)
    }

    /**
     * Notes mode: transcribe only (no Gemini, no credits). Applies dictionary
     * corrections + snippet expansion so saved notes match what the user meant.
     * Returns "" when no speech was detected.
     */
    suspend fun transcribeForNote(pcmData: ByteArray): String = withContext(Dispatchers.IO) {
        try {
            val raw = runSTT(pcmData)
            if (raw.isBlank()) return@withContext ""
            val (snippets, dictWords) = loadLocalContext()
            preprocessTranscript(raw, snippets, dictWords)
        } catch (e: Exception) {
            Log.e(TAG, "transcribeForNote failed", e)
            ""
        }
    }

    // ============================================
    // Direct Text Processing (no STT needed)
    // ============================================

    /**
     * Process already-typed text through Gemini
     * Useful for grammar-checking selected text
     */
    suspend fun processText(
        text: String,
        mode: String,
    ): PipelineResult = withContext(Dispatchers.IO) {
        try {
            // Credit check
            val creditCheck = checkCreditsBeforeRecording(mode)
            if (!creditCheck.allowed) {
                return@withContext PipelineResult(
                    success = false,
                    error = creditCheck.reason ?: "Credits exhausted",
                )
            }

            // Load context and pre-process
            val (snippets, dictWords) = loadLocalContext()
            val processedText = preprocessTranscript(text, snippets, dictWords)

            val result = GeminiService.processVoiceInput(processedText, mode, snippets, dictWords)

            if (result.isFailure) {
                return@withContext PipelineResult(
                    success = false,
                    error = result.exceptionOrNull()?.message ?: "Processing failed",
                )
            }

            // Increment usage
            try {
                SupabaseManager.checkAndIncrementUsage(mode)
            } catch (_: Exception) {}

            PipelineResult(
                success = true,
                transcript = text,
                processedText = result.getOrThrow(),
            )
        } catch (e: Exception) {
            PipelineResult(success = false, error = e.message)
        }
    }

    /**
     * Release all resources (call from service onDestroy)
     */
    fun release() {
        try {
            sherpaSTT?.release()
            sherpaSTT = null
            Log.d(TAG, "VoicePipeline released")
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing VoicePipeline", e)
        }
    }
}

data class CreditCheckResult(
    val allowed: Boolean,
    val reason: String? = null,
)

data class PipelineResult(
    val success: Boolean,
    val transcript: String? = null,
    val processedText: String? = null,
    val error: String? = null,
)

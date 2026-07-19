package com.juskoe.app.data

import android.util.Log
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Lightweight analytics — writes events to the existing Supabase `logs` table.
 *
 * Design principles:
 *  - Fire-and-forget: never blocks UI, never returns a result to the caller.
 *  - Silent failures: swallows all exceptions; analytics must never crash the app.
 *  - No new dependencies: uses the existing SupabaseManager + Postgrest.
 *  - Minimal payload: user_id is inferred server-side via RLS (auth.uid()).
 *
 * The `logs` table schema (already deployed):
 *   id UUID PK, user_id UUID (FK profiles), action TEXT, mode TEXT?,
 *   latency_ms INT?, input_length INT?, output_length INT?, created_at TIMESTAMPTZ
 */
object AnalyticsManager {

    private const val TAG = "Analytics"
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // ─── Public event methods ───────────────────────────────────────────

    /** User opened the app (cold start). */
    fun trackAppOpen() = log("app_open")

    /** New user signed up (first auth). */
    fun trackSignup() = log("signup")

    /** AI voice pipeline completed successfully. */
    fun trackAiComplete(latencyMs: Int, inputLength: Int, outputLength: Int) =
        log("ai_complete", mode = "ai", latencyMs = latencyMs, inputLen = inputLength, outLen = outputLength)

    /** Grammar voice pipeline completed successfully. */
    fun trackGrammarComplete(latencyMs: Int, inputLength: Int, outputLength: Int) =
        log("grammar_complete", mode = "grammar", latencyMs = latencyMs, inputLen = inputLength, outLen = outputLength)

    /** Note created (from keyboard voice or app UI). */
    fun trackNoteCreated() = log("note_created")

    /** Float JUSKOE delivered text. */
    fun trackFloatUsed(mode: String) = log("float_used", mode = mode)

    /** Pipeline or API error. mode = ai/grammar/null; message stored as input_length=-1 sentinel. */
    fun trackError(mode: String?, errorMsg: String?) =
        log("error", mode = mode, inputLen = -1, outLen = errorMsg?.length ?: 0)

    // ─── Internal ───────────────────────────────────────────────────────

    private fun log(
        action: String,
        mode: String? = null,
        latencyMs: Int? = null,
        inputLen: Int? = null,
        outLen: Int? = null,
    ) {
        // Only log for authenticated users (logs table requires user_id via RLS).
        if (!SupabaseManager.isAuthenticated()) return

        scope.launch {
            try {
                SupabaseManager.client.postgrest.from("logs").insert(
                    LogEntry(
                        action = action,
                        mode = mode,
                        latencyMs = latencyMs,
                        inputLength = inputLen,
                        outputLength = outLen,
                    )
                )
            } catch (e: Exception) {
                // Silent — analytics must never affect the user experience.
                Log.d(TAG, "Failed to log '$action': ${e.message}")
            }
        }
    }
}

@kotlinx.serialization.Serializable
private data class LogEntry(
    val action: String,
    val mode: String? = null,
    @kotlinx.serialization.SerialName("latency_ms") val latencyMs: Int? = null,
    @kotlinx.serialization.SerialName("input_length") val inputLength: Int? = null,
    @kotlinx.serialization.SerialName("output_length") val outputLength: Int? = null,
)

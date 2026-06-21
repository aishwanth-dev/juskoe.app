package com.juskoe.app.data

import com.juskoe.app.BuildConfig

/**
 * JUSKOE Configuration
 *
 * SECURITY: No secrets are hardcoded here. Client-safe values (Supabase URL,
 * anon key, OAuth client IDs, Edge Function URL) are injected at build time
 * from a gitignored `local.properties` via BuildConfig. The raw Gemini API key
 * is NOT present in the app — AI requests are proxied through the `ai-proxy`
 * Supabase Edge Function, which holds the key server-side.
 */
object Config {
    // Supabase (client-safe: anon key is public; RLS protects data)
    val SUPABASE_URL = BuildConfig.SUPABASE_URL
    val SUPABASE_ANON_KEY = BuildConfig.SUPABASE_ANON_KEY

    // Gemini model name (the API key lives only in the Edge Function env: KJUS)
    const val GEMINI_MODEL = "gemini-2.5-flash-lite"

    // Supabase Edge Functions base URL (e.g. https://<ref>.supabase.co/functions/v1)
    val EDGE_FUNCTION_URL = BuildConfig.EDGE_FUNCTION_URL
    val AI_PROXY_URL = "$EDGE_FUNCTION_URL/ai-proxy"

    // Google OAuth client IDs (not secrets)
    val GOOGLE_WEB_CLIENT_ID = BuildConfig.GOOGLE_WEB_CLIENT_ID
    val GOOGLE_ANDROID_CLIENT_ID = BuildConfig.GOOGLE_ANDROID_CLIENT_ID

    // Plan Limits
    object FreePlan {
        const val DAILY_AI = 10
        const val DAILY_GRAMMAR = 15
        const val DAILY_TOTAL = 25
        const val MONTHLY_TOTAL = 200
    }

    object ProPlan {
        const val DAILY_AI = 100
        const val DAILY_GRAMMAR = 100
        const val DAILY_TOTAL = 200
        const val MONTHLY_TOTAL = 5000
    }

    fun limitsForPlan(plan: String) = if (plan == "pro") ProPlan else FreePlan

    // Audio
    const val AUDIO_SAMPLE_RATE = 16000
    const val AUDIO_CHANNELS = 1
    const val AUDIO_BIT_DEPTH = 16

    // App
    const val APP_NAME = "Juskoe"
    const val APP_VERSION = "1.0.0"
}

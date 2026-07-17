package com.juskoe.app.data

/**
 * JUSKOE Configuration
 * Mirrors shared/config.ts from Electron app
 */
object Config {
    // Supabase
    const val SUPABASE_URL = "https://rrromegwhhkyjsfxvesu.supabase.co"
    const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycm9tZWd3aGhreWpzZnh2ZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjM1NDIsImV4cCI6MjA4Njc5OTU0Mn0.m0bJCOLoBFCMnFFhb2SaKoYandShMLxJ90etIDewErE"

    // Gemini
    const val GEMINI_MODEL = "gemini-2.5-flash-lite"
    const val GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    // Google OAuth (Web Client ID from Google Cloud Console)
    const val GOOGLE_WEB_CLIENT_ID = "640023056571-oddu9p2sdfajt4unn816pv9q4oiesddu.apps.googleusercontent.com"

    // Google OAuth (Android Client ID — must match SHA-1 fingerprint)
    const val GOOGLE_ANDROID_CLIENT_ID = "640023056571-lsrjmhti0k731ef697h9icndt4n7kbip.apps.googleusercontent.com"

    // API key (same obfuscation as Electron app)
    val GEMINI_API_KEY: String by lazy {
        val k = intArrayOf(65,73,122,97,83,121,65,82,120,72,116,89,54,70,49,116,110,82,71,49,90,115,121,117,55,67,68,55,51,97,86,102,107,76,71,89,117,57,85)
        String(k.map { it.toChar() }.toCharArray())
    }

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

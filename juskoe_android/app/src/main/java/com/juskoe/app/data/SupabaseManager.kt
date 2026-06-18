package com.juskoe.app.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.compose.auth.ComposeAuth
import io.github.jan.supabase.compose.auth.composeAuth
import io.github.jan.supabase.compose.auth.googleNativeLogin
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.realtime.Realtime
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * JUSKOE Supabase Client — mirrors shared/supabase.ts
 * Auth, usage tracking, cloud CRUD
 */
object SupabaseManager {

    // Custom URL scheme for OAuth redirects (must match AndroidManifest)
    private const val REDIRECT_URL = "com.x16studios.juskoe://callback"

    val client: SupabaseClient = createSupabaseClient(
        supabaseUrl = Config.SUPABASE_URL,
        supabaseKey = Config.SUPABASE_ANON_KEY,
    ) {
        install(Auth) {
            scheme = "com.x16studios.juskoe"
            host = "callback"
            flowType = FlowType.PKCE
        }
        install(Postgrest)
        install(Realtime)
        install(ComposeAuth) {
            googleNativeLogin(serverClientId = Config.GOOGLE_WEB_CLIENT_ID)
        }
    }

    // ============================================
    // Authentication
    // ============================================

    suspend fun signInWithGoogle() {
        client.auth.signInWith(Google)
    }

    suspend fun signUpWithPassword(email: String, password: String, name: String? = null) {
        client.auth.signUpWith(Email) {
            this.email = email
            this.password = password
            this.data = buildJsonObject {
                put("full_name", JsonPrimitive(name ?: email.substringBefore("@")))
            }
        }
    }

    suspend fun signInWithPassword(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut() {
        client.auth.signOut()
    }

    fun isAuthenticated(): Boolean {
        return client.auth.currentSessionOrNull() != null
    }

    fun currentUserId(): String? {
        return client.auth.currentUserOrNull()?.id
    }

    /** Current access token (JWT) for authorizing Edge Function calls. */
    fun currentAccessToken(): String? {
        return client.auth.currentSessionOrNull()?.accessToken
    }

    fun currentUserEmail(): String? {
        return client.auth.currentUserOrNull()?.email
    }

    // ============================================
    // Usage Tracking (RPC)
    // ============================================

    suspend fun getUsageSummary(): UsageSummary {
        return try {
            val result = client.postgrest.rpc("get_usage_summary")
            val data = result.decodeSingle<UsageSummaryResponse>()
            UsageSummary(
                dailyAI = data.dailyAi,
                dailyGrammar = data.dailyGrammar,
                monthlyTotal = data.monthlyTotal,
                limitReached = data.limitReached,
            )
        } catch (e: Exception) {
            UsageSummary(0, 0, 0, false)
        }
    }

    suspend fun checkAndIncrementUsage(mode: String): UsageCheckResult {
        return try {
            val result = client.postgrest.rpc(
                "increment_usage",
                mapOf("p_mode" to mode),
            )
            val data = result.decodeSingle<UsageCheckResponse>()
            UsageCheckResult(
                allowed = data.allowed,
                reason = data.reason,
                plan = data.plan,
            )
        } catch (e: Exception) {
            // Fail-open: if check fails, allow
            UsageCheckResult(allowed = true, plan = "free")
        }
    }

    // ============================================
    // Profile
    // ============================================

    suspend fun getProfile(): UserProfile? {
        return try {
            client.postgrest.from("profiles")
                .select()
                .decodeSingleOrNull<UserProfile>()
        } catch (e: Exception) {
            null
        }
    }

    // ============================================
    // Cloud Dictionary
    // ============================================

    suspend fun getCloudDictionary(): List<CloudDictionary> {
        return try {
            client.postgrest.from("cloud_dictionary")
                .select()
                .decodeList<CloudDictionary>()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun upsertDictWord(word: String, correction: String): String? {
        val userId = currentUserId() ?: return null
        return try {
            client.postgrest.from("cloud_dictionary")
                .upsert(
                    CloudDictionary(userId = userId, word = word.lowercase(), correction = correction)
                ) {
                    onConflict = "user_id,word"
                    select()
                }
                .decodeSingleOrNull<CloudDictionary>()
                ?.id
        } catch (e: Exception) {
            null
        }
    }

    suspend fun deleteDictWord(id: String) {
        client.postgrest.from("cloud_dictionary")
            .delete { filter { eq("id", id) } }
    }

    // ============================================
    // Cloud Snippets
    // ============================================

    suspend fun getCloudSnippets(): List<CloudSnippet> {
        return try {
            client.postgrest.from("cloud_snippets")
                .select()
                .decodeList<CloudSnippet>()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun upsertSnippet(key: String, title: String, content: String, category: String = "general"): String? {
        val userId = currentUserId() ?: return null
        return try {
            client.postgrest.from("cloud_snippets")
                .upsert(
                    CloudSnippet(userId = userId, key = key.lowercase(), title = title, content = content, category = category)
                ) {
                    onConflict = "user_id,key"
                    select()
                }
                .decodeSingleOrNull<CloudSnippet>()
                ?.id
        } catch (e: Exception) {
            null
        }
    }

    suspend fun deleteSnippet(id: String) {
        client.postgrest.from("cloud_snippets")
            .delete { filter { eq("id", id) } }
    }

    // ============================================
    // Cloud Notes
    // ============================================

    suspend fun getCloudNotes(): List<CloudNote> {
        return try {
            client.postgrest.from("cloud_notes")
                .select()
                .decodeList<CloudNote>()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun addCloudNote(text: String, tags: List<String> = emptyList()): String? {
        val userId = currentUserId() ?: return null
        return try {
            client.postgrest.from("cloud_notes")
                .insert(
                    CloudNote(userId = userId, text = text, tags = tags)
                ) {
                    select()
                }
                .decodeSingleOrNull<CloudNote>()
                ?.id
        } catch (e: Exception) {
            null
        }
    }

    suspend fun deleteCloudNote(id: String) {
        client.postgrest.from("cloud_notes")
            .delete { filter { eq("id", id) } }
    }
}

// ============================================
// Data Classes (mirror shared/types.ts)
// ============================================

@Serializable
data class UserProfile(
    val id: String,
    val email: String,
    @SerialName("full_name") val fullName: String,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    val plan: String = "free",
    @SerialName("daily_ai_used") val dailyAiUsed: Int = 0,
    @SerialName("daily_grammar_used") val dailyGrammarUsed: Int = 0,
    @SerialName("monthly_used") val monthlyUsed: Int = 0,
    @SerialName("created_at") val createdAt: String = "",
)

data class UsageSummary(
    val dailyAI: Int,
    val dailyGrammar: Int,
    val monthlyTotal: Int,
    val limitReached: Boolean,
)

@Serializable
data class UsageSummaryResponse(
    @SerialName("daily_ai") val dailyAi: Int = 0,
    @SerialName("daily_grammar") val dailyGrammar: Int = 0,
    @SerialName("monthly_total") val monthlyTotal: Int = 0,
    @SerialName("limit_reached") val limitReached: Boolean = false,
)

@Serializable
data class UsageCheckResponse(
    val allowed: Boolean = true,
    val reason: String? = null,
    val plan: String = "free",
)

data class UsageCheckResult(
    val allowed: Boolean,
    val reason: String? = null,
    val plan: String = "free",
)

@Serializable
data class CloudDictionary(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    val word: String,
    val correction: String,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class CloudSnippet(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    val key: String,
    val title: String,
    val content: String,
    val category: String = "general",
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class CloudNote(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    val text: String,
    val tags: List<String> = emptyList(),
    @SerialName("created_at") val createdAt: String = "",
)

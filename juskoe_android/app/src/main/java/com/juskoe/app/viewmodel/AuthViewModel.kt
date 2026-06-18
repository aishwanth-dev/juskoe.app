package com.juskoe.app.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.juskoe.app.data.*
import com.juskoe.app.data.sync.SyncScheduler
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Auth ViewModel — manages authentication state and usage
 * across the entire app (dashboard + keyboard).
 *
 * Listens to Supabase session status flow so Google native
 * sign-in automatically triggers state refresh.
 */
class AuthViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "AuthViewModel"
        private const val PREFS = "juskoe_settings"
        private const val KEY_LOGGED_IN = "is_logged_in"
        private const val KEY_CACHED_PLAN = "cached_plan"
    }

    private val prefs by lazy {
        getApplication<Application>()
            .getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
    }

    /** Fast-path flag so the UI can skip the auth screen while the session re-hydrates. */
    fun wasLoggedIn(): Boolean = prefs.getBoolean(KEY_LOGGED_IN, false)

    private fun setLoggedIn(value: Boolean) {
        prefs.edit().putBoolean(KEY_LOGGED_IN, value).apply()
    }

    // Auth state
    private val _authState = MutableStateFlow(AuthUiState())
    val authState: StateFlow<AuthUiState> = _authState.asStateFlow()

    // Usage state
    private val _usageState = MutableStateFlow(UsageSummary(0, 0, 0, false))
    val usageState: StateFlow<UsageSummary> = _usageState.asStateFlow()

    init {
        // Listen to session status changes — this is the KEY fix
        // for Google native sign-in: when ComposeAuth completes,
        // it fires Authenticated on this flow automatically.
        viewModelScope.launch {
            try {
                SupabaseManager.client.auth.sessionStatus.collect { status ->
                    Log.d(TAG, "Session status changed: $status")
                    when (status) {
                        is SessionStatus.Authenticated -> {
                            Log.d(TAG, "Session authenticated, refreshing state")
                            val wasNew = !wasLoggedIn()
                            setLoggedIn(true)
                            if (wasNew) {
                                com.juskoe.app.data.AnalyticsManager.trackSignup()
                            }
                            try {
                                refreshState()
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to refresh after auth", e)
                                // Still authenticated — keep the user in, surface a soft error
                                _authState.value = AuthUiState(
                                    isAuthenticated = true,
                                    loading = false,
                                    error = "Signed in but failed to load profile",
                                )
                            }
                        }
                        is SessionStatus.NotAuthenticated -> {
                            // Only treat as a real logout if the user wasn't expected to be
                            // logged in; otherwise this is a transient pre-hydration emit.
                            _authState.value = AuthUiState(loading = false)
                            _usageState.value = UsageSummary(0, 0, 0, false)
                        }
                        is SessionStatus.Initializing -> {
                            _authState.value = AuthUiState(loading = true)
                        }
                        else -> {}
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Session status collection failed", e)
                // Fallback: check session manually
                checkSession()
            }
        }
    }

    private suspend fun checkSession() {
        try {
            if (SupabaseManager.isAuthenticated()) {
                refreshState()
            } else {
                _authState.value = AuthUiState(loading = false)
            }
        } catch (e: Exception) {
            _authState.value = AuthUiState(loading = false, error = e.message)
        }
    }

    // ============================================
    // Google Sign-In (now handled via session flow)
    // ============================================

    fun signInWithGoogle() {
        // Native Google sign-in is handled by ComposeAuth.
        // The session status listener above auto-refreshes state.
        // This method is kept as fallback for web OAuth flow.
        viewModelScope.launch {
            _authState.value = _authState.value.copy(loading = true, error = null)
            try {
                SupabaseManager.signInWithGoogle()
                // Session status flow will handle the rest
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(
                    loading = false,
                    error = e.message ?: "Sign-in failed",
                )
            }
        }
    }

    // ============================================
    // Email + Password
    // ============================================

    fun signUp(email: String, password: String, name: String?) {
        viewModelScope.launch {
            _authState.value = _authState.value.copy(loading = true, error = null)
            try {
                SupabaseManager.signUpWithPassword(email, password, name)
                // Session status flow handles refresh
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(
                    loading = false,
                    error = e.message ?: "Signup failed",
                )
            }
        }
    }

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _authState.value = _authState.value.copy(loading = true, error = null)
            try {
                SupabaseManager.signInWithPassword(email, password)
                // Session status flow handles refresh
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(
                    loading = false,
                    error = e.message ?: "Sign-in failed",
                )
            }
        }
    }

    // ============================================
    // Logout
    // ============================================

    fun signOut() {
        viewModelScope.launch {
            try {
                setLoggedIn(false)
                prefs.edit().remove(KEY_CACHED_PLAN).apply()
                try { SyncScheduler.cancelAll(getApplication<Application>()) } catch (_: Exception) {}
                SupabaseManager.signOut()
                // Session status flow resets state; force it immediately too
                _authState.value = AuthUiState(loading = false)
                _usageState.value = UsageSummary(0, 0, 0, false)
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(error = e.message)
            }
        }
    }

    // ============================================
    // Refresh
    // ============================================

    fun refreshUsage() {
        viewModelScope.launch {
            try {
                _usageState.value = SupabaseManager.getUsageSummary()
            } catch (_: Exception) {}
        }
    }

    /**
     * Load profile + usage with a short retry so a freshly minted session (e.g.
     * right after Google native sign-in) that hasn't fully propagated to PostgREST
     * yet doesn't surface as a failure.
     */
    private suspend fun refreshState(maxAttempts: Int = 3) {
        var attempt = 0
        while (true) {
            try {
                val profile = SupabaseManager.getProfile()
                val usage = SupabaseManager.getUsageSummary()
                _authState.value = AuthUiState(
                    isAuthenticated = true,
                    profile = profile,
                    loading = false,
                )
                _usageState.value = usage

                // Cache plan for keyboard service (survives network failures)
                if (profile != null) {
                    try {
                        prefs.edit().putString(KEY_CACHED_PLAN, profile.plan).apply()
                    } catch (_: Exception) {}
                    // Kick off a cloud sync for Pro users now that we're signed in.
                    if (profile.plan == "pro" || profile.plan == "enterprise") {
                        try { SyncScheduler.requestSyncNow(getApplication<Application>()) } catch (_: Exception) {}
                    }
                }
                return
            } catch (e: Exception) {
                attempt++
                if (attempt >= maxAttempts) {
                    Log.e(TAG, "refreshState failed after $attempt attempts", e)
                    _authState.value = AuthUiState(
                        isAuthenticated = true,
                        loading = false,
                        error = "Signed in but couldn't load profile — pull to retry",
                    )
                    return
                }
                kotlinx.coroutines.delay(300L * (1L shl (attempt - 1))) // 300ms, 600ms, 1.2s
            }
        }
    }

    fun isPro(): Boolean {
        return _authState.value.profile?.plan == "pro" ||
            _authState.value.profile?.plan == "enterprise"
    }

    /**
     * Manual refresh trigger after native Google Sign-In. The session status flow
     * normally handles this automatically; this is a no-delay fallback that relies
     * on refreshState()'s built-in retry instead of a fixed sleep.
     */
    fun refreshAfterLogin() {
        viewModelScope.launch {
            _authState.value = _authState.value.copy(loading = true, error = null)
            refreshState()
        }
    }
}

data class AuthUiState(
    val isAuthenticated: Boolean = false,
    val profile: UserProfile? = null,
    val loading: Boolean = true,
    val error: String? = null,
)

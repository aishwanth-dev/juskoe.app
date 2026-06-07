package com.juskoe.app.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.juskoe.app.data.*
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
                            try {
                                refreshState()
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to refresh after auth", e)
                                _authState.value = AuthUiState(
                                    isAuthenticated = true,
                                    loading = false,
                                    error = "Signed in but failed to load profile",
                                )
                            }
                        }
                        is SessionStatus.NotAuthenticated -> {
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
                SupabaseManager.signOut()
                // Session status flow handles state reset
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

    private suspend fun refreshState() {
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
                getApplication<Application>().getSharedPreferences("juskoe_settings", android.content.Context.MODE_PRIVATE)
                    .edit().putString("cached_plan", profile.plan).apply()
            } catch (_: Exception) {}
        }
    }

    fun isPro(): Boolean {
        return _authState.value.profile?.plan == "pro"
    }

    /**
     * Called after native Google Sign-In completes.
     * Session status flow should handle this automatically,
     * but this serves as a manual refresh trigger.
     */
    fun refreshAfterLogin() {
        viewModelScope.launch {
            _authState.value = _authState.value.copy(loading = true, error = null)
            try {
                // Small delay to let session propagate
                kotlinx.coroutines.delay(500)
                refreshState()
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(
                    loading = false,
                    error = e.message ?: "Failed to load profile",
                )
            }
        }
    }
}

data class AuthUiState(
    val isAuthenticated: Boolean = false,
    val profile: UserProfile? = null,
    val loading: Boolean = true,
    val error: String? = null,
)

package com.juskoe.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.ui.navigation.JuskoeNavHost
import com.juskoe.app.ui.theme.JuskoeTheme
import com.juskoe.app.viewmodel.AuthViewModel
import io.github.jan.supabase.auth.handleDeeplinks

class MainActivity : ComponentActivity() {

    private val authViewModel: AuthViewModel by viewModels()

    // Permission launchers
    private val requestPermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        results.forEach { (perm, granted) ->
            Log.d("MainActivity", "Permission $perm granted: $granted")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Handle OAuth deep-link if the activity was launched via callback
        handleOAuthIntent(intent)

        // Request all needed permissions on first launch
        requestNeededPermissions()

        setContent {
            val darkMode = getSharedPreferences("juskoe_settings", MODE_PRIVATE)
                .getBoolean("dark_mode", false)
            JuskoeTheme(darkTheme = darkMode) {
                val authState by authViewModel.authState.collectAsState()
                val usageState by authViewModel.usageState.collectAsState()

                Surface(modifier = Modifier.fillMaxSize()) {
                    JuskoeNavHost(
                        authState = authState,
                        usageState = usageState,
                        onGoogleSignIn = { authViewModel.refreshAfterLogin() },
                        onSignUp = { email, pass, name -> authViewModel.signUp(email, pass, name) },
                        onSignIn = { email, pass -> authViewModel.signIn(email, pass) },
                        onSignOut = { authViewModel.signOut() },
                        onRefreshUsage = { authViewModel.refreshUsage() },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleOAuthIntent(intent)
    }

    private fun handleOAuthIntent(intent: Intent?) {
        try {
            intent?.data?.let { uri ->
                Log.d("MainActivity", "handleOAuthIntent: ${uri.scheme}://${uri.host}")
                SupabaseManager.client.handleDeeplinks(intent)
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "handleOAuthIntent failed", e)
        }
    }

    /**
     * Request RECORD_AUDIO + storage permissions like a real Android app.
     * Shows system "Allow" / "Deny" dialogs.
     */
    private fun requestNeededPermissions() {
        val needed = mutableListOf<String>()

        // Mic permission (always needed)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.RECORD_AUDIO)
        }

        // Storage permissions (for local caching of dict, snippets, notes, results)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ — granular media permissions (not needed for app-internal storage,
            // but good to have for future export features)
        } else {
            // Android 12 and below
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED
            ) {
                needed.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED
            ) {
                needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }

        if (needed.isNotEmpty()) {
            requestPermissions.launch(needed.toTypedArray())
        }
    }
}

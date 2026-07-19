package com.juskoe.app.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.juskoe.app.R
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.ui.theme.*
import com.juskoe.app.viewmodel.AuthUiState
import io.github.jan.supabase.compose.auth.composable.NativeSignInResult
import io.github.jan.supabase.compose.auth.composable.rememberSignInWithGoogle
import io.github.jan.supabase.compose.auth.composeAuth

@Composable
fun AuthScreen(
    authState: AuthUiState,
    onGoogleSignIn: () -> Unit,
    onSignUp: (String, String, String?) -> Unit,
    onSignIn: (String, String) -> Unit,
    onSkip: () -> Unit = {},
) {
    var isSignUp by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    val context = LocalContext.current

    // Auto-redirect on successful login
    LaunchedEffect(authState.isAuthenticated) {
        if (authState.isAuthenticated) {
            Toast.makeText(context, "✅ Signed in successfully!", Toast.LENGTH_SHORT).show()
            // Small delay to show toast, then redirect
            kotlinx.coroutines.delay(500)
            onSkip()
        }
    }

    // Show error Toast
    LaunchedEffect(authState.error) {
        authState.error?.let {
            Toast.makeText(context, "❌ $it", Toast.LENGTH_LONG).show()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(modifier = Modifier.height(48.dp))

        // Logo
        Image(
            painter = painterResource(id = R.drawable.juskoe_logo),
            contentDescription = "JUSKOE Logo",
            modifier = Modifier.size(64.dp),
        )
        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "JUSKOE",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = Brown,
            letterSpacing = (-1).sp,
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "Your voice, your keyboard",
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
        )

        Spacer(modifier = Modifier.height(40.dp))

        // Google Sign In — Native flow (no browser redirect)
        val googleSignIn = SupabaseManager.client.composeAuth.rememberSignInWithGoogle(
            onResult = { result ->
                when (result) {
                    is NativeSignInResult.Success -> {
                        onGoogleSignIn()
                    }
                    is NativeSignInResult.Error -> {
                        Toast.makeText(context, "❌ Google sign-in failed", Toast.LENGTH_SHORT).show()
                    }
                    is NativeSignInResult.ClosedByUser -> {
                        Toast.makeText(context, "Sign-in cancelled", Toast.LENGTH_SHORT).show()
                    }
                    is NativeSignInResult.NetworkError -> {
                        Toast.makeText(context, "❌ Network error — check connection", Toast.LENGTH_SHORT).show()
                    }
                }
            },
            fallback = { onGoogleSignIn() },
        )

        Button(
            onClick = { googleSignIn.startFlow() },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.surface,
            ),
            elevation = ButtonDefaults.buttonElevation(2.dp),
        ) {
            // Google "G" icon
            Image(
                painter = painterResource(id = R.drawable.ic_google),
                contentDescription = "Google",
                modifier = Modifier.size(20.dp),
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "Continue with Google",
                color = Brown,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Divider
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HorizontalDivider(modifier = Modifier.weight(1f), color = BrownBorder)
            Text(
                text = "  or  ",
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted,
            )
            HorizontalDivider(modifier = Modifier.weight(1f), color = BrownBorder)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Sign up name field
        AnimatedVisibility(visible = isSignUp) {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full name") },
                    leadingIcon = { Icon(Icons.Filled.Person, null) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                )
                Spacer(modifier = Modifier.height(12.dp))
            }
        }

        // Email
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            leadingIcon = { Icon(Icons.Filled.Email, null) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            singleLine = true,
        )
        Spacer(modifier = Modifier.height(12.dp))

        // Password
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            leadingIcon = { Icon(Icons.Filled.Lock, null) },
            trailingIcon = {
                IconButton(onClick = { showPassword = !showPassword }) {
                    Icon(
                        if (showPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        null,
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            singleLine = true,
        )
        Spacer(modifier = Modifier.height(20.dp))

        // Submit button
        Button(
            onClick = {
                if (isSignUp) onSignUp(email, password, name.ifBlank { null })
                else onSignIn(email, password)
            },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Purple),
            enabled = email.isNotBlank() && password.length >= 6 && !authState.loading,
        ) {
            if (authState.loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = White,
                    strokeWidth = 2.dp,
                )
            } else {
                Text(
                    if (isSignUp) "Create Account" else "Sign In",
                    fontWeight = FontWeight.SemiBold,
                    color = White,
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Toggle sign up / sign in
        TextButton(
            onClick = { isSignUp = !isSignUp },
        ) {
            Text(
                if (isSignUp) "Already have an account? Sign In" else "Don't have an account? Sign Up",
                color = TextMuted,
                fontSize = 13.sp,
            )
        }

        // Error
        if (authState.error != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = Error.copy(alpha = 0.1f)),
            ) {
                Text(
                    text = authState.error,
                    modifier = Modifier.padding(12.dp),
                    color = Error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Skip / Continue Offline button
        TextButton(
            onClick = onSkip,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                "Continue offline",
                color = TextMuted,
                fontSize = 14.sp,
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

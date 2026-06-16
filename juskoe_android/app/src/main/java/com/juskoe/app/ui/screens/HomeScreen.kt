package com.juskoe.app.ui.screens

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Spellcheck
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.juskoe.app.R
import com.juskoe.app.data.Config
import com.juskoe.app.data.UsageSummary
import com.juskoe.app.data.local.GeneratedContentEntry
import com.juskoe.app.data.local.JuskoeDatabase
import com.juskoe.app.ui.theme.*
import com.juskoe.app.viewmodel.AuthUiState
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private fun isKeyboardEnabled(context: Context): Boolean {
    val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    val inputMethods = imm.enabledInputMethodList
    return inputMethods.any { it.packageName == context.packageName }
}

private fun getGreeting(name: String): String {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    val prefix = when {
        hour < 12 -> "Good morning"
        hour < 17 -> "Good afternoon"
        else -> "Good evening"
    }
    return if (name.isNotBlank()) "$prefix, $name" else prefix
}

@Composable
fun HomeScreen(
    authState: AuthUiState,
    usageState: UsageSummary,
    onNavigateToAuth: () -> Unit,
    onRefreshUsage: () -> Unit,
) {
    val context = LocalContext.current
    val keyboardEnabled = remember { isKeyboardEnabled(context) }
    val scope = rememberCoroutineScope()

    // Dismissible quick guide
    val prefs = remember { context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE) }
    var showQuickGuide by remember { mutableStateOf(!prefs.getBoolean("quick_guide_dismissed", false)) }

    // Greeting
    val userName = authState.profile?.fullName?.split(" ")?.firstOrNull() ?: ""
    val greeting = remember(userName) { getGreeting(userName) }

    // History from Room DB — observed reactively so keyboard output appears instantly
    val db = remember { JuskoeDatabase.getInstance(context) }
    val history by db.generatedContentDao().getRecentFlow().collectAsState(initial = emptyList())
    LaunchedEffect(Unit) { onRefreshUsage() }

    // Determine plan — check cached plan immediately to avoid flash
    val cachedPlan = remember {
        context.getSharedPreferences("juskoe_settings", Context.MODE_PRIVATE)
            .getString("cached_plan", null)
    }
    val isPro = authState.profile?.plan == "pro" || cachedPlan == "pro" || cachedPlan == "enterprise"
    val aiTotal = if (isPro) Config.ProPlan.DAILY_AI else Config.FreePlan.DAILY_AI
    val grammarTotal = if (isPro) Config.ProPlan.DAILY_GRAMMAR else Config.FreePlan.DAILY_GRAMMAR

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        // Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(
                        painter = painterResource(id = R.drawable.juskoe_logo),
                        contentDescription = "JUSKOE Logo",
                        modifier = Modifier.size(44.dp),
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "JUSKOE",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Brown,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = if (authState.isAuthenticated) greeting
                            else "Voice Powered Productivity",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                        )
                    }
                }

                if (!authState.isAuthenticated) {
                    Button(
                        onClick = onNavigateToAuth,
                        colors = ButtonDefaults.buttonColors(containerColor = Purple),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Login, null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Sign in")
                    }
                }
            }
            Spacer(modifier = Modifier.height(20.dp))
        }

        // Enable keyboard card
        if (!keyboardEnabled) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = BgSecondary),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Keyboard,
                            contentDescription = null,
                            tint = Brown,
                            modifier = Modifier.size(32.dp),
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Enable JUSKOE Keyboard",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                text = "Go to Settings → Keyboards to enable",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextMuted,
                            )
                        }
                        Button(
                            onClick = { openKeyboardSettings(context) },
                            colors = ButtonDefaults.buttonColors(containerColor = Brown),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Text("Enable")
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
        }

        // Credits Row
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CreditCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Filled.Mic,
                    label = "AI Mode",
                    used = usageState.dailyAI,
                    total = aiTotal,
                    color = Purple,
                    isPro = isPro,
                )
                CreditCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Filled.Spellcheck,
                    label = "Grammar",
                    used = usageState.dailyGrammar,
                    total = grammarTotal,
                    color = Amber,
                    isPro = isPro,
                )
            }
            Spacer(modifier = Modifier.height(20.dp))
        }

        // Quick Guide
        if (showQuickGuide) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Brown),
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = "Quick Guide",
                                style = MaterialTheme.typography.titleLarge,
                                color = TextOnBrown,
                                fontWeight = FontWeight.Bold,
                            )
                            IconButton(
                                onClick = {
                                    showQuickGuide = false
                                    prefs.edit().putBoolean("quick_guide_dismissed", true).apply()
                                },
                                modifier = Modifier.size(28.dp),
                            ) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "Dismiss",
                                    tint = TextLight,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        GuideStep(Icons.Filled.Mic, "AI Mode", "Swipe right on the top bar → hold to record")
                        Spacer(modifier = Modifier.height(12.dp))
                        GuideStep(Icons.Filled.Spellcheck, "Grammar Mode", "Swipe left on the top bar → hold to record")
                    }
                }
                Spacer(modifier = Modifier.height(20.dp))
            }
        }

        // Recent / History
        item {
            Text(
                text = "Recent",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary,
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        if (history.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = BgSecondary),
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("No commands yet", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Use the JUSKOE keyboard to start dictating", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                    }
                }
            }
        } else {
            items(history, key = { it.id }) { item ->
                HistoryCard(
                    entry = item,
                    onDelete = {
                        history.removeIf { h -> h.id == item.id }
                        scope.launch {
                            try {
                                JuskoeDatabase.getInstance(context).generatedContentDao().deleteById(item.id)
                            } catch (_: Exception) {}
                        }
                    },
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }

        item {
            Spacer(modifier = Modifier.height(20.dp))

            // Plan banner
            if (authState.isAuthenticated && authState.profile?.plan != "pro") {
                OutlinedButton(
                    onClick = { /* TODO: upgrade */ },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("⚡ Upgrade to Pro — Unlimited credits + Cloud Sync")
                }
            } else if (!authState.isAuthenticated) {
                OutlinedButton(
                    onClick = onNavigateToAuth,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("Sign in to track your usage across devices")
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun HistoryCard(
    entry: GeneratedContentEntry,
    onDelete: () -> Unit,
) {
    val context = LocalContext.current
    val timeFormat = remember { SimpleDateFormat("h:mm a", Locale.getDefault()) }
    val dateFormat = remember { SimpleDateFormat("MMM d", Locale.getDefault()) }
    val time = remember(entry.createdAt) { timeFormat.format(Date(entry.createdAt)) }
    val date = remember(entry.createdAt) { dateFormat.format(Date(entry.createdAt)) }

    var showDetailDialog by remember { mutableStateOf(false) }
    var showCopied by remember { mutableStateOf(false) }

    // Auto-reset "Copied" after 1.5s
    LaunchedEffect(showCopied) {
        if (showCopied) {
            kotlinx.coroutines.delay(1500)
            showCopied = false
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize()
            .then(
                Modifier.clip(RoundedCornerShape(12.dp))
            ),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = BgSecondary),
        onClick = { showDetailDialog = true },
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (entry.mode == "ai") Icons.Filled.Mic else Icons.Filled.Spellcheck,
                        contentDescription = null,
                        tint = if (entry.mode == "ai") Purple else Amber,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (entry.mode == "ai") "AI" else "Grammar",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (entry.mode == "ai") Purple else Amber,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "$date · $time",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextLight,
                    )
                    // Copy button with animation
                    IconButton(
                        onClick = {
                            val clipboardManager = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboardManager.setPrimaryClip(android.content.ClipData.newPlainText("JUSKOE", entry.output))
                            showCopied = true
                        },
                        modifier = Modifier.size(28.dp),
                    ) {
                        androidx.compose.animation.AnimatedVisibility(
                            visible = showCopied,
                        ) {
                            Icon(Icons.Filled.Check, null, tint = Success, modifier = Modifier.size(16.dp))
                        }
                        androidx.compose.animation.AnimatedVisibility(
                            visible = !showCopied,
                        ) {
                            Icon(Icons.Filled.ContentCopy, null, tint = TextMuted, modifier = Modifier.size(16.dp))
                        }
                    }
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(28.dp),
                    ) {
                        Icon(Icons.Filled.Delete, null, tint = Error, modifier = Modifier.size(16.dp))
                    }
                }
            }
            if (showCopied) {
                Text("Copied!", style = MaterialTheme.typography.labelSmall, color = Success)
            }
            if (entry.input.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = entry.input,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = entry.output,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }

    // Full message popup dialog
    if (showDetailDialog) {
        var dialogCopied by remember { mutableStateOf(false) }
        LaunchedEffect(dialogCopied) {
            if (dialogCopied) {
                kotlinx.coroutines.delay(1500)
                dialogCopied = false
            }
        }

        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showDetailDialog = false },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            if (entry.mode == "ai") Icons.Filled.Mic else Icons.Filled.Spellcheck,
                            contentDescription = null,
                            tint = if (entry.mode == "ai") Purple else Amber,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (entry.mode == "ai") "AI Mode" else "Grammar",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Text("$date · $time", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                }
            },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    if (entry.input.isNotBlank()) {
                        Text("Input:", style = MaterialTheme.typography.labelMedium, color = TextMuted, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(entry.input, style = MaterialTheme.typography.bodyMedium, color = TextMuted)
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                    Text("Output:", style = MaterialTheme.typography.labelMedium, color = TextMuted, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(entry.output, style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val clipboardManager = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                        clipboardManager.setPrimaryClip(android.content.ClipData.newPlainText("JUSKOE", entry.output))
                        dialogCopied = true
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = if (dialogCopied) Success else Brown),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Icon(
                        if (dialogCopied) Icons.Filled.Check else Icons.Filled.ContentCopy,
                        null,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (dialogCopied) "Copied ✓" else "Copy")
                }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { showDetailDialog = false }) {
                    Text("Close", color = TextMuted)
                }
            },
        )
    }
}

@Composable
private fun CreditCard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    label: String,
    used: Int,
    total: Int,
    color: androidx.compose.ui.graphics.Color,
    isPro: Boolean = false,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = BgSecondary),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary,
                )
            }
            Spacer(modifier = Modifier.height(10.dp))

            if (isPro) {
                Text(
                    text = "∞",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = color,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Unlimited",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted,
                )
            } else {
                Text(
                    text = "$used / $total",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (used >= total) Error else TextPrimary,
                )
                Spacer(modifier = Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress = { (used.toFloat() / total).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)),
                    color = if (used >= total) Error else color,
                    trackColor = Border,
                )
            }
        }
    }
}

@Composable
private fun GuideStep(icon: ImageVector, title: String, desc: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = TextOnBrown, modifier = Modifier.size(22.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = TextOnBrown,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = desc,
                style = MaterialTheme.typography.bodySmall,
                color = TextLight,
            )
        }
    }
}

private fun openKeyboardSettings(context: Context) {
    context.startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
}

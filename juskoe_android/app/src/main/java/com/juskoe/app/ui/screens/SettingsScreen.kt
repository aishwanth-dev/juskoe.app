package com.juskoe.app.ui.screens

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Spellcheck
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Vibration
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.juskoe.app.data.Config
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.data.UsageSummary
import com.juskoe.app.data.UserProfile
import com.juskoe.app.floating.FloatManager
import com.juskoe.app.ui.theme.*
import kotlinx.coroutines.launch

// ============================================
// Persistent Settings Helper
// ============================================

private fun getPrefs(context: Context) =
    context.getSharedPreferences("juskoe_settings", Context.MODE_PRIVATE)

private fun readBool(context: Context, key: String, default: Boolean): Boolean =
    getPrefs(context).getBoolean(key, default)

private fun writeBool(context: Context, key: String, value: Boolean) {
    getPrefs(context).edit().putBoolean(key, value).apply()
}

// ============================================
// Main Screen
// ============================================

@Composable
fun SettingsScreen(
    profile: UserProfile?,
    usage: UsageSummary,
    onSignOut: () -> Unit,
    onNavigateToAuth: () -> Unit,
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("General", "System", "Account")
    val isPro = profile?.plan == "pro"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        // Header
        Text(
            text = "Settings",
            style = MaterialTheme.typography.headlineLarge,
            color = Brown,
        )
        Text(
            text = "Configure your JUSKOE experience",
            style = MaterialTheme.typography.bodySmall,
            color = TextMuted,
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Tab bar
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = BgSecondary,
            contentColor = Brown,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = Brown,
                )
            },
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Text(
                            text = title,
                            color = if (selectedTab == index) Brown else TextMuted,
                            fontWeight = if (selectedTab == index) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    },
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        when (selectedTab) {
            0 -> GeneralTab(isPro = isPro)
            1 -> SystemTab()
            2 -> AccountTab(profile, usage, isPro, onSignOut, onNavigateToAuth)
        }
    }
}

// ============================================
// General Tab — persisted settings + cloud sync
// ============================================

@Composable
private fun GeneralTab(isPro: Boolean) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Read persisted state
    var isMicEnabled by remember { mutableStateOf(readBool(context, "mic_enabled", true)) }
    var isAutoCapitalize by remember { mutableStateOf(readBool(context, "auto_capitalize", true)) }
    var isAutocorrect by remember { mutableStateOf(readBool(context, "autocorrect", true)) }
    var isSoundOnKey by remember { mutableStateOf(readBool(context, "key_sound", false)) }
    var isCloudSync by remember { mutableStateOf(readBool(context, "cloud_sync", false)) }

    Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        SectionHeader("Keyboard")

        SettingItem(
            icon = Icons.Filled.Keyboard,
            title = "Enable JUSKOE Keyboard",
            subtitle = "Opens system keyboard settings",
            onClick = {
                context.startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            },
        )

        SettingItem(
            icon = Icons.Filled.Keyboard,
            title = "Set as Default",
            subtitle = "Choose JUSKOE as your active keyboard",
            onClick = {
                val mgr = context.getSystemService(Context.INPUT_METHOD_SERVICE)
                if (mgr is android.view.inputmethod.InputMethodManager) {
                    mgr.showInputMethodPicker()
                }
            },
        )

        HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

        SectionHeader("Voice Input")

        ToggleItem(
            icon = Icons.Filled.Mic,
            title = "Microphone",
            subtitle = "Enable voice-to-text input",
            checked = isMicEnabled,
            onCheckedChange = { isMicEnabled = it; writeBool(context, "mic_enabled", it) },
        )

        HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

        SectionHeader("Cloud Sync")

        if (isPro) {
            var isPushing by remember { mutableStateOf(false) }
            var pushCountdown by remember { mutableIntStateOf(0) }

            ToggleItem(
                icon = Icons.Filled.Sync,
                title = if (isPushing) "Pushing… ${pushCountdown}s" else "Cloud Sync",
                subtitle = if (isPushing) "Syncing local data to cloud…"
                           else "Sync dictionary, snippets & notes to cloud",
                checked = isCloudSync,
                enabled = !isPushing,
                onCheckedChange = { newVal ->
                    isCloudSync = newVal
                    writeBool(context, "cloud_sync", newVal)
                    if (newVal) {
                        // Toggle ON → push all un-synced local data
                        isPushing = true
                        pushCountdown = 20
                        scope.launch {
                            // Countdown timer (visual feedback)
                            val countdownJob = launch {
                                while (pushCountdown > 0) {
                                    kotlinx.coroutines.delay(1000)
                                    pushCountdown--
                                }
                            }
                            // Actual push
                            try {
                                val db = com.juskoe.app.data.local.JuskoeDatabase.getInstance(context)
                                // Push dict entries without cloudId
                                val dictItems = db.dictDao().getAllOnce()
                                for (d in dictItems) {
                                    if (d.cloudId == null) {
                                        try {
                                            com.juskoe.app.data.SupabaseManager.upsertDictWord(d.word, d.correction)
                                        } catch (_: Exception) {}
                                    }
                                }
                                // Push snippet entries without cloudId
                                val snippetItems = db.snippetDao().getAllOnce()
                                for (s in snippetItems) {
                                    if (s.cloudId == null) {
                                        try {
                                            com.juskoe.app.data.SupabaseManager.upsertSnippet(s.key, s.title, s.content, s.category)
                                        } catch (_: Exception) {}
                                    }
                                }
                                // Push note entries without cloudId
                                val noteItems = db.noteDao().getAllOnce()
                                for (n in noteItems) {
                                    if (n.cloudId == null) {
                                        try {
                                            com.juskoe.app.data.SupabaseManager.addCloudNote(n.text, n.tags.split(",").filter { it.isNotBlank() })
                                        } catch (_: Exception) {}
                                    }
                                }
                            } catch (_: Exception) {}
                            // Wait for countdown to finish
                            countdownJob.join()
                            isPushing = false
                        }
                    }
                },
            )
        } else {
            SettingItem(
                icon = Icons.Filled.Lock,
                title = "Cloud Sync",
                subtitle = "Upgrade to Pro to enable cloud sync",
                value = "\uD83D\uDD12 PRO",
            )
        }

        HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

        SectionHeader("Typing")

        ToggleItem(
            icon = Icons.Filled.Spellcheck,
            title = "Auto-capitalize",
            subtitle = "Capitalize first letter of sentences",
            checked = isAutoCapitalize,
            onCheckedChange = { isAutoCapitalize = it; writeBool(context, "auto_capitalize", it) },
        )

        ToggleItem(
            icon = Icons.Filled.Spellcheck,
            title = "Autocorrect",
            subtitle = "Automatically fix common typos",
            checked = isAutocorrect,
            onCheckedChange = { isAutocorrect = it; writeBool(context, "autocorrect", it) },
        )

        ToggleItem(
            icon = Icons.AutoMirrored.Filled.VolumeUp,
            title = "Key Sound",
            subtitle = "Play sound on each keypress",
            checked = isSoundOnKey,
            onCheckedChange = { isSoundOnKey = it; writeBool(context, "key_sound", it) },
        )

        HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

        SectionHeader("Speech Languages")

        // Dynamic language picker
        val selectedLangs = remember {
            mutableStateListOf<String>().also { list ->
                list.addAll(com.juskoe.app.data.SherpaSTT.getSelectedLanguages(context))
            }
        }
        var showLangPicker by remember { mutableStateOf(false) }
        val selectedNames = com.juskoe.app.data.SherpaSTT.SUPPORTED_LANGUAGES
            .filter { (code, _) -> selectedLangs.contains(code) }
            .joinToString(", ") { (_, name) -> name }

        SettingItem(
            icon = Icons.Filled.Language,
            title = "STT Languages",
            subtitle = if (selectedNames.length > 40) selectedNames.take(40) + "…" else selectedNames,
            onClick = { showLangPicker = !showLangPicker },
        )

        if (showLangPicker) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = BgSecondary),
            ) {
                Column(modifier = Modifier.padding(8.dp).height(280.dp)) {
                    androidx.compose.foundation.lazy.LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        items(com.juskoe.app.data.SherpaSTT.SUPPORTED_LANGUAGES.size) { idx ->
                            val (code, name) = com.juskoe.app.data.SherpaSTT.SUPPORTED_LANGUAGES[idx]
                            val isSelected = selectedLangs.contains(code)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) Brown.copy(alpha = 0.08f) else androidx.compose.ui.graphics.Color.Transparent)
                                    .clickable {
                                        if (isSelected) {
                                            if (selectedLangs.size > 1) selectedLangs.remove(code)
                                        } else {
                                            selectedLangs.add(code)
                                        }
                                        com.juskoe.app.data.SherpaSTT.saveSelectedLanguages(context, selectedLangs.toList())
                                    }
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Switch(
                                    checked = isSelected,
                                    onCheckedChange = null,
                                    colors = SwitchDefaults.colors(
                                        checkedTrackColor = Brown,
                                        uncheckedTrackColor = BorderLight,
                                    ),
                                    modifier = Modifier.size(width = 40.dp, height = 20.dp),
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(name, style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                    color = if (isSelected) Brown else TextPrimary)
                                Spacer(modifier = Modifier.weight(1f))
                                Text(code.uppercase(), style = MaterialTheme.typography.labelSmall, color = TextMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================
// System Tab — persisted settings
// ============================================

@Composable
private fun SystemTab() {
    val context = LocalContext.current

    var isDarkMode by remember { mutableStateOf(readBool(context, "dark_mode", false)) }
    var isHapticFeedback by remember { mutableStateOf(readBool(context, "haptic_feedback", true)) }
    var isDebugMode by remember { mutableStateOf(readBool(context, "debug_mode", false)) }

    Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        SectionHeader("Appearance")

        ToggleItem(
            icon = Icons.Filled.DarkMode,
            title = "Dark Mode",
            subtitle = "Use dark color scheme for the app",
            checked = isDarkMode,
            onCheckedChange = {
                isDarkMode = it
                writeBool(context, "dark_mode", it)
                // Apply immediately by recreating the activity with the new theme.
                (context as? android.app.Activity)?.recreate()
            },
        )

        HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

        SectionHeader("Feedback")

        ToggleItem(
            icon = Icons.Filled.Vibration,
            title = "Haptic Feedback",
            subtitle = "Vibrate on key press",
            checked = isHapticFeedback,
            onCheckedChange = { isHapticFeedback = it; writeBool(context, "haptic_feedback", it) },
        )

        HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

        SectionHeader("Float JUSKOE")

        var isFloat by remember {
            mutableStateOf(FloatManager.isEnabledPref(context) && FloatManager.canDrawOverlay(context))
        }
        ToggleItem(
            icon = Icons.Filled.Tune,
            title = "Float JUSKOE",
            subtitle = "A floating mic button that works over any app/keyboard",
            checked = isFloat,
            onCheckedChange = { enabled ->
                if (enabled) {
                    if (FloatManager.enable(context)) {
                        isFloat = true
                    } else {
                        // Needs the "display over other apps" permission first.
                        isFloat = false
                        context.startActivity(FloatManager.overlayPermissionIntent(context))
                    }
                } else {
                    FloatManager.disable(context)
                    isFloat = false
                }
            },
        )
        SettingItem(
            icon = Icons.Filled.Tune,
            title = "Float text insertion",
            subtitle = "Enable JUSKOE accessibility so results paste into any app",
            onClick = {
                context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            },
        )

        HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

        SectionHeader("Developer")

        ToggleItem(
            icon = Icons.Filled.BugReport,
            title = "Debug Mode",
            subtitle = "Show extra logging info",
            checked = isDebugMode,
            onCheckedChange = { isDebugMode = it; writeBool(context, "debug_mode", it) },
        )

        HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

        SectionHeader("App Info")

        SettingItem(
            icon = Icons.Filled.Info,
            title = "Version",
            subtitle = "JUSKOE Android",
            value = Config.APP_VERSION,
        )

        SettingItem(
            icon = Icons.Filled.Refresh,
            title = "Reset Onboarding",
            subtitle = "Show the onboarding slides again",
            onClick = {
                context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean("onboarding_done", false)
                    .apply()
            },
        )
    }
}

// ============================================
// Account Tab — dynamic limits
// ============================================

@Composable
private fun AccountTab(
    profile: UserProfile?,
    usage: UsageSummary,
    isPro: Boolean,
    onSignOut: () -> Unit,
    onNavigateToAuth: () -> Unit,
) {
    val aiTotal = if (isPro) Config.ProPlan.DAILY_AI else Config.FreePlan.DAILY_AI
    val grammarTotal = if (isPro) Config.ProPlan.DAILY_GRAMMAR else Config.FreePlan.DAILY_GRAMMAR
    val monthlyTotal = if (isPro) Config.ProPlan.MONTHLY_TOTAL else Config.FreePlan.MONTHLY_TOTAL

    Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (profile != null) {
            // Profile card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = BgSecondary),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(Purple),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = (profile.fullName.firstOrNull() ?: 'U').uppercase(),
                            style = MaterialTheme.typography.headlineSmall,
                            color = White,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(
                            text = profile.fullName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary,
                        )
                        Text(
                            text = profile.email,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                        )
                        Text(
                            text = "${profile.plan.replaceFirstChar { it.uppercase() }} Plan",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isPro) Purple else Amber,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }

            // Usage card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = BgSecondary),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Today's Usage",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary,
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    UsageBar(
                        label = "AI Mode",
                        used = usage.dailyAI,
                        total = aiTotal,
                        color = Purple,
                        isPro = isPro,
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    UsageBar(
                        label = "Grammar Mode",
                        used = usage.dailyGrammar,
                        total = grammarTotal,
                        color = Amber,
                        isPro = isPro,
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    UsageBar(
                        label = "Monthly Total",
                        used = usage.monthlyTotal,
                        total = monthlyTotal,
                        color = Success,
                        isPro = isPro,
                    )
                }
            }

            // Sign out
            Button(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Error),
                shape = RoundedCornerShape(12.dp),
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, "Sign Out", modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Sign Out")
            }
        } else {
            // Not signed in
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = BgSecondary),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        Icons.Filled.AccountCircle,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(56.dp),
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "You're using JUSKOE offline",
                        style = MaterialTheme.typography.titleSmall,
                        color = TextPrimary,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Sign in to sync your data across devices",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = onNavigateToAuth,
                        colors = ButtonDefaults.buttonColors(containerColor = Brown),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Sign In")
                    }
                }
            }
        }
    }
}

// ============================================
// UsageBar — now supports ∞ for pro
// ============================================

@Composable
private fun UsageBar(
    label: String,
    used: Int,
    total: Int,
    color: androidx.compose.ui.graphics.Color,
    isPro: Boolean = false,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted,
            )
            if (isPro) {
                Text(
                    text = "∞",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = color,
                )
            } else {
                Text(
                    text = "$used / $total",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (used >= total) Error else TextPrimary,
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        if (isPro) {
            // Full green bar for pro
            LinearProgressIndicator(
                progress = { 1f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = color,
                trackColor = Border,
            )
        } else {
            LinearProgressIndicator(
                progress = { (used.toFloat() / total).coerceIn(0f, 1f) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = if (used >= total) Error else color,
                trackColor = Border,
            )
        }
    }
}

// ============================================
// Reusable Settings Components
// ============================================

@Composable
private fun SectionHeader(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(vertical = 6.dp),
    )
}

@Composable
private fun SettingItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    value: String? = null,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Brown,
            modifier = Modifier.size(22.dp),
        )
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = TextPrimary,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted,
            )
        }
        if (value != null) {
            Text(
                text = value,
                style = MaterialTheme.typography.labelMedium,
                color = Purple,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun ToggleItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (enabled) Brown else TextLight,
            modifier = Modifier.size(22.dp),
        )
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = if (enabled) TextPrimary else TextLight,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted,
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = if (enabled) onCheckedChange else { _ -> },
            enabled = enabled,
            colors = SwitchDefaults.colors(
                checkedThumbColor = White,
                checkedTrackColor = Brown,
                uncheckedThumbColor = White,
                uncheckedTrackColor = Border,
                disabledCheckedThumbColor = TextLight,
                disabledCheckedTrackColor = Border,
                disabledUncheckedThumbColor = TextLight,
                disabledUncheckedTrackColor = Border,
            ),
        )
    }
}

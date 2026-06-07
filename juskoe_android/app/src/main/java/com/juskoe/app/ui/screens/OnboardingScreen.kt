package com.juskoe.app.ui.screens

import android.content.Context
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.juskoe.app.R
import com.juskoe.app.data.SherpaSTT
import com.juskoe.app.ui.theme.*
import kotlinx.coroutines.launch

data class OnboardingPage(
    val title: String,
    val description: String,
)

private val infoPages = listOf(
    OnboardingPage(
        title = "Welcome to JUSKOE",
        description = "Your voice-powered productivity keyboard. Speak naturally and let JUSKOE do the rest.",
    ),
    OnboardingPage(
        title = "AI & Grammar Modes",
        description = "Swipe right for AI mode, swipe left for grammar correction. Hold to record and release to process.",
    ),
    OnboardingPage(
        title = "Fast & Offline",
        description = "On-device speech-to-text runs without internet. Your voice, your privacy, your productivity.",
    ),
)

// Total pages = info pages + 1 language picker page
private const val TOTAL_PAGES = 4

@Composable
fun OnboardingScreen(
    onComplete: () -> Unit,
) {
    val context = LocalContext.current
    val pagerState = rememberPagerState(pageCount = { TOTAL_PAGES })
    val scope = rememberCoroutineScope()

    // Language selection state — pre-select English
    val selectedLanguages = remember { mutableStateListOf("en") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(White)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(modifier = Modifier.height(48.dp))

        // Logo
        Image(
            painter = painterResource(id = R.drawable.juskoe_logo),
            contentDescription = "JUSKOE Logo",
            modifier = Modifier.size(80.dp),
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Pager
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
        ) { page ->
            if (page < infoPages.size) {
                // Info pages (0, 1, 2)
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = infoPages[page].title,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = Brown,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = infoPages[page].description,
                        style = MaterialTheme.typography.bodyLarge,
                        color = TextMuted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            } else {
                // Page 3: Language Picker
                LanguagePickerPage(
                    selectedLanguages = selectedLanguages,
                    onToggle = { code ->
                        if (selectedLanguages.contains(code)) {
                            // Don't allow deselecting the last language
                            if (selectedLanguages.size > 1) selectedLanguages.remove(code)
                        } else {
                            selectedLanguages.add(code)
                        }
                    },
                )
            }
        }

        // Indicators
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(vertical = 12.dp),
        ) {
            repeat(TOTAL_PAGES) { i ->
                Box(
                    modifier = Modifier
                        .size(if (pagerState.currentPage == i) 10.dp else 8.dp)
                        .clip(CircleShape)
                        .background(if (pagerState.currentPage == i) Brown else Border),
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Buttons
        if (pagerState.currentPage == TOTAL_PAGES - 1) {
            Button(
                onClick = {
                    // Save language selections
                    SherpaSTT.saveSelectedLanguages(context, selectedLanguages.toList())
                    // Mark onboarding as done
                    context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE)
                        .edit().putBoolean("onboarding_done", true).apply()
                    onComplete()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Brown),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text("Get Started", fontWeight = FontWeight.SemiBold)
            }
        } else {
            Button(
                onClick = { scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) } },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Brown),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text(
                    if (pagerState.currentPage == infoPages.size - 1) "Pick Languages" else "Next",
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        TextButton(
            onClick = {
                SherpaSTT.saveSelectedLanguages(context, selectedLanguages.toList())
                context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE)
                    .edit().putBoolean("onboarding_done", true).apply()
                onComplete()
            },
        ) {
            Text("Skip", color = TextMuted)
        }

        Spacer(modifier = Modifier.height(12.dp))
    }
}

// ============================================
// Language Picker Page
// ============================================

@Composable
private fun LanguagePickerPage(
    selectedLanguages: List<String>,
    onToggle: (String) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Pick your languages",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = Brown,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Juskoe will detect speech in the languages you select. You can change this anytime in Settings.",
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        Spacer(modifier = Modifier.height(16.dp))

        // Scrollable language list
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            items(SherpaSTT.SUPPORTED_LANGUAGES) { (code, name) ->
                val isSelected = selectedLanguages.contains(code)
                LanguageRow(
                    code = code,
                    name = name,
                    isSelected = isSelected,
                    onClick = { onToggle(code) },
                )
            }
        }
    }
}

@Composable
private fun LanguageRow(
    code: String,
    name: String,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    val bgColor by animateColorAsState(
        targetValue = if (isSelected) Brown.copy(alpha = 0.08f) else Color.Transparent,
        animationSpec = tween(200),
        label = "langBg",
    )
    val borderColor by animateColorAsState(
        targetValue = if (isSelected) Brown else Border,
        animationSpec = tween(200),
        label = "langBorder",
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Checkbox indicator
        Box(
            modifier = Modifier
                .size(24.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(if (isSelected) Brown else Color.Transparent)
                .border(
                    width = if (isSelected) 0.dp else 1.5.dp,
                    color = if (isSelected) Brown else Border,
                    shape = RoundedCornerShape(6.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (isSelected) {
                Icon(
                    Icons.Filled.Check,
                    contentDescription = "Selected",
                    tint = Color.White,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
        Spacer(modifier = Modifier.width(14.dp))
        Text(
            text = name,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (isSelected) Brown else TextPrimary,
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = code.uppercase(),
            fontSize = 12.sp,
            color = TextMuted,
            fontWeight = FontWeight.Medium,
        )
    }
}

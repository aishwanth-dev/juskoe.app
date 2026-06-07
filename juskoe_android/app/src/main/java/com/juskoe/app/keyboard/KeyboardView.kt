package com.juskoe.app.keyboard

import android.view.inputmethod.EditorInfo
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.KeyboardHide
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.EmojiEmotions
import androidx.compose.material3.Icon
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.juskoe.app.R
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

// ── Samsung Dimensions ──
private val KEY_H = 46.dp
private val NUM_H = 42.dp
private val KEY_GAP_H = 4.dp
private val KEY_GAP_V = 6.dp
private val KEY_R = 5.dp
private val MODE_H = 48.dp
private val TOOL_H = 32.dp
private val CONTENT_H = NUM_H + (KEY_H * 4) + (KEY_GAP_V * 4) + 8.dp

// ── Samsung Dark Colors ──
private val KBG = Color(0xFF1B1B1B)
private val KEY_BG = Color(0xFF2C2C2E)
private val KEY_BG_SP = Color(0xFF232325)
private val KEY_BG_PRESS = Color(0xFF454548)
private val KEY_TXT = Color(0xFFE5E5E5)
private val ACCENT = Color(0xFF8B5CF6)
private val MUTED = Color(0xFF6E6E6E)
private val ORANGE = Color(0xFFFF9500)
private val ERROR_RED = Color(0xFFFF3B30)
private val SWIPE_THRESHOLD = 100f

// ── Samsung keymaps ──
private val ALPHA_R1 = listOf("q","w","e","r","t","y","u","i","o","p")
private val ALPHA_R2 = listOf("a","s","d","f","g","h","j","k","l")
private val ALPHA_R3 = listOf("z","x","c","v","b","n","m")

private val NUM_ROW = listOf("1","2","3","4","5","6","7","8","9","0")

private val SYM1_R1 = listOf("+","×","÷","=","/","_","<",">","[","]")
private val SYM1_R2 = listOf("!","@","#","$","%","^","&","*","(",")")
private val SYM1_R3 = listOf("\"","'",":",";",",","?")

private val SYM2_R1 = listOf("`","~","\\","|","{","}","€","£","¥","₩")
private val SYM2_R2 = listOf("©","®","™","✓","¶","°","•","¿","¡","§")
private val SYM2_R3 = listOf("♣","♠","♥","♦","★","☆")

// ══════════════════════════════════════════
// MAIN KEYBOARD
// ══════════════════════════════════════════

@Composable
fun KeyboardView(
    state: KeyboardState,
    onKeyPress: (String) -> Unit,
    onModeSwipe: (VoiceMode) -> Unit,
    onExpandToggle: () -> Unit,
    onBackspace: () -> Unit,
    onEnter: () -> Unit,
    onSpace: () -> Unit,
    onShiftToggle: () -> Unit = {},
    onCancel: () -> Unit = {},
    onDone: () -> Unit = {},
    onAction: () -> Unit = {},
    onToolClick: (String) -> Unit = {},
    onSuggestionClick: (String) -> Unit = {},
    onClipboardPaste: (String) -> Unit = {},
    onClipboardToggle: () -> Unit = {},
) {
    val isModeActive = state.activeMode != VoiceMode.NONE
    var showEmoji by remember { mutableStateOf(false) }
    var forceTools by remember { mutableStateOf(false) }
    val hasSuggestions = state.suggestions.isNotEmpty()
    val showSuggestions = hasSuggestions && !forceTools

    LaunchedEffect(hasSuggestions) { if (!hasSuggestions) forceTools = false }

    Column(Modifier.fillMaxWidth().background(KBG)) {
        if (isModeActive) {
            ActiveModeBar(state, onCancel, onDone)
        } else {
            ModeStrip(state, onModeSwipe)
        }

        if (!isModeActive) {
            Crossfade(targetState = showSuggestions, animationSpec = tween(130), label = "ts") { isSug ->
                if (isSug) SuggestionBar(state.suggestions, onSuggestionClick) { forceTools = true }
                else ToolRow(state, onExpandToggle, { showEmoji = !showEmoji }, onToolClick)
            }
        }

        Box(Modifier.fillMaxWidth().height(CONTENT_H).background(KBG)) {
            when {
                isModeActive -> BigEqualizer(state)
                state.showClipboard -> ClipboardTray(state.clipboardHistory, onClipboardPaste, onClipboardToggle)
                showEmoji -> EmojiGrid { e -> onKeyPress(e); showEmoji = false }
                else -> {
                    if (state.isQwertyExpanded) KeysContent(state, onKeyPress, onBackspace, onSpace, onShiftToggle, onAction)
                    else CollapsedLogo()
                }
            }
        }
    }
}

// ══════════════════════════════════════════
// MODE STRIP — AI / Grammar / Notes
// ══════════════════════════════════════════

@Composable
private fun ModeStrip(state: KeyboardState, onModeSwipe: (VoiceMode) -> Unit) {
    var aiDrag by remember { mutableFloatStateOf(0f) }
    var gDrag by remember { mutableFloatStateOf(0f) }
    val aiShift by animateFloatAsState(if (aiDrag > 10f) aiDrag.coerceAtMost(80f) else 0f, tween(50), label = "as")
    val gShift by animateFloatAsState(if (gDrag < -10f) gDrag.coerceAtLeast(-80f) else 0f, tween(50), label = "gs")
    val aiA by animateFloatAsState(if (aiDrag > 15f) 1f else 0.3f, tween(100), label = "aa")
    val gA by animateFloatAsState(if (gDrag < -15f) 1f else 0.3f, tween(100), label = "ga")

    Row(Modifier.fillMaxWidth().height(MODE_H).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        // AI — swipe right or tap
        Box(Modifier.weight(1f).height(MODE_H)
            .draggable(rememberDraggableState { d -> aiDrag = (aiDrag + d).coerceAtLeast(0f) },
                Orientation.Horizontal, onDragStopped = { if (aiDrag > SWIPE_THRESHOLD) onModeSwipe(VoiceMode.AI); aiDrag = 0f })
        ) {
            Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.offset { IntOffset(aiShift.roundToInt(), 0) }.clip(RoundedCornerShape(10.dp))
                    .background(if (aiDrag > 20f) ACCENT.copy(0.15f) else KEY_BG_SP)
                    .clickable { onModeSwipe(VoiceMode.AI) }.padding(horizontal = 12.dp, vertical = 7.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("AI", color = if (aiDrag > 20f) ACCENT else KEY_TXT, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(4.dp))
                        Text(if (state.aiCreditsTotal < 0) "∞" else "${state.aiCredits}/${state.aiCreditsTotal}", color = MUTED, fontSize = 11.sp)
                    }
                }
                Spacer(Modifier.width(8.dp))
                Text("»", color = ACCENT.copy(aiA), fontSize = 18.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.offset { IntOffset((aiShift * 0.6f).roundToInt(), 0) })
            }
        }

        // Grammar — swipe left or tap
        Box(Modifier.weight(1f).height(MODE_H)
            .draggable(rememberDraggableState { d -> gDrag = (gDrag + d).coerceAtMost(0f) },
                Orientation.Horizontal, onDragStopped = { if (gDrag < -SWIPE_THRESHOLD) onModeSwipe(VoiceMode.GRAMMAR); gDrag = 0f })
        ) {
            Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.End) {
                Text("«", color = ACCENT.copy(gA), fontSize = 18.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.offset { IntOffset((gShift * 0.6f).roundToInt(), 0) })
                Spacer(Modifier.width(8.dp))
                Box(Modifier.offset { IntOffset(gShift.roundToInt(), 0) }.clip(RoundedCornerShape(10.dp))
                    .background(if (gDrag < -20f) ACCENT.copy(0.15f) else KEY_BG_SP)
                    .clickable { onModeSwipe(VoiceMode.GRAMMAR) }.padding(horizontal = 12.dp, vertical = 7.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("G", color = if (gDrag < -20f) ACCENT else KEY_TXT, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(4.dp))
                        Text(if (state.grammarCreditsTotal < 0) "∞" else "${state.grammarCredits}/${state.grammarCreditsTotal}", color = MUTED, fontSize = 11.sp)
                    }
                }
            }
        }

        Spacer(Modifier.width(6.dp))
        Box(Modifier.width(42.dp).height(36.dp).clip(RoundedCornerShape(10.dp)).background(KEY_BG_SP)
            .clickable { onModeSwipe(VoiceMode.NOTES) }, contentAlignment = Alignment.Center) {
            Text("N", color = KEY_TXT, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// ── TOOL ROW ──
@Composable
private fun ToolRow(state: KeyboardState, onCollapse: () -> Unit, onEmoji: () -> Unit, onTool: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().height(TOOL_H).padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceEvenly) {
        ToolBtn(Icons.Outlined.EmojiEmotions, onEmoji)
        ToolBtn(Icons.Filled.Settings) { onTool("settings") }
        Box(Modifier.size(36.dp).clickable(onClick = onCollapse), contentAlignment = Alignment.Center) {
            Icon(if (state.isQwertyExpanded) Icons.Filled.KeyboardArrowDown else Icons.Filled.KeyboardArrowUp,
                "Toggle", tint = MUTED, modifier = Modifier.size(20.dp))
        }
        ToolBtn(Icons.Filled.KeyboardHide) { onTool("language") }
        ToolBtn(Icons.Filled.ContentPaste) { onTool("clipboard") }
    }
}

@Composable
private fun ToolBtn(icon: ImageVector, onClick: () -> Unit) {
    Icon(icon, null, tint = MUTED, modifier = Modifier.size(18.dp).clickable(onClick = onClick))
}

// ── SUGGESTION BAR ──
@Composable
private fun SuggestionBar(suggestions: List<String>, onClick: (String) -> Unit, onBack: () -> Unit) {
    Row(Modifier.fillMaxWidth().height(TOOL_H).padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(28.dp).clip(RoundedCornerShape(6.dp)).background(KEY_BG_SP).clickable(onClick = onBack),
            contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.ChevronLeft, "tools", tint = MUTED, modifier = Modifier.size(16.dp))
        }
        suggestions.forEach { w ->
            Box(Modifier.weight(1f).height(26.dp).clip(RoundedCornerShape(6.dp)).background(KEY_BG_SP).clickable { onClick(w) },
                contentAlignment = Alignment.Center) {
                Text(w, color = KEY_TXT, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

// ── ACTIVE MODE BAR ──
@Composable
private fun ActiveModeBar(state: KeyboardState, onCancel: () -> Unit, onDone: () -> Unit) {
    Row(Modifier.fillMaxWidth().height(MODE_H + TOOL_H).background(KBG).padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Row(Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onCancel).padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Close, null, tint = MUTED, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(4.dp))
            Text("Cancel", color = MUTED, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
        Text(when (state.activeMode) { VoiceMode.AI -> "AI Mode"; VoiceMode.GRAMMAR -> "Grammar"; VoiceMode.NOTES -> "Notes"; else -> "" },
            color = ACCENT, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Row(Modifier.clip(RoundedCornerShape(8.dp)).background(ACCENT).clickable(onClick = onDone).padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Done, null, tint = Color.White, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(4.dp))
            Text("Done", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ── BIG EQUALIZER ──
@Composable
private fun BigEqualizer(state: KeyboardState) {
    val inf = rememberInfiniteTransition(label = "eq")
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(bottom = 24.dp)) {
            Box(Modifier.height(80.dp).fillMaxWidth(0.6f), contentAlignment = Alignment.Center) {
                when (state.voiceState) {
                    VoiceState.IDLE, VoiceState.READY -> {
                        val p by inf.animateFloat(0.5f, 1f, infiniteRepeatable(tween(600), RepeatMode.Reverse), label = "p")
                        Text("🎤", fontSize = 40.sp, modifier = Modifier.graphicsLayer(alpha = p))
                    }
                    VoiceState.RECORDING -> {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            repeat(9) { i ->
                                val h by inf.animateFloat(10f, 65f, infiniteRepeatable(tween(400 + i * 70, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "b$i")
                                Box(Modifier.width(6.dp).height(h.dp).clip(RoundedCornerShape(3.dp)).background(Color.White.copy(0.85f)))
                            }
                        }
                    }
                    VoiceState.PROCESSING -> {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            repeat(9) { i ->
                                val h by inf.animateFloat(4f, 30f, infiniteRepeatable(tween(300 + i * 50, easing = LinearEasing), RepeatMode.Reverse), label = "p$i")
                                Box(Modifier.width(6.dp).height(h.dp).clip(RoundedCornerShape(3.dp)).background(ORANGE.copy(0.85f)))
                            }
                        }
                    }
                    VoiceState.DONE -> JuskoeBranding(Color.White, 28.sp)
                }
            }
            Spacer(Modifier.height(12.dp))
            when (state.voiceState) {
                VoiceState.RECORDING -> Text("Listening", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                VoiceState.PROCESSING -> Text("processing...", color = ORANGE, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                VoiceState.DONE -> Text("✓", color = Color.White, fontSize = 16.sp)
                else -> Text("starting...", color = MUTED, fontSize = 13.sp)
            }
        }
        state.errorMessage?.let { msg ->
            Box(Modifier.fillMaxWidth(0.85f).clip(RoundedCornerShape(12.dp)).background(Color(0xFF2C2C2E)).padding(14.dp),
                contentAlignment = Alignment.Center) {
                Text(msg, color = ERROR_RED, fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
            }
        }
    }
}

// ── COLLAPSED LOGO ──
@Composable
private fun CollapsedLogo() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            androidx.compose.foundation.Image(painter = painterResource(id = R.drawable.juskoe_logo),
                contentDescription = "Juskoe", modifier = Modifier.size(48.dp))
            Spacer(Modifier.height(8.dp))
            JuskoeBranding(KEY_TXT, 20.sp)
        }
    }
}

// ── CLIPBOARD TRAY ──
@Composable
private fun ClipboardTray(history: List<String>, onPaste: (String) -> Unit, onClose: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Clipboard", color = KEY_TXT, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Icon(Icons.Filled.Close, "Close", tint = MUTED, modifier = Modifier.size(16.dp).clickable(onClick = onClose))
        }
        Spacer(Modifier.height(6.dp))
        if (history.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No clips yet", color = MUTED, fontSize = 12.sp) }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(history) { clip ->
                    Box(Modifier.fillMaxWidth().padding(vertical = 2.dp).clip(RoundedCornerShape(8.dp)).background(KEY_BG_SP)
                        .clickable { onPaste(clip); onClose() }.padding(10.dp)) {
                        Text(clip.take(100), color = KEY_TXT, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

// ── EMOJI GRID ──
@Composable
private fun EmojiGrid(onPick: (String) -> Unit) {
    var cat by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize()) {
        ScrollableTabRow(selectedTabIndex = cat, containerColor = KBG, contentColor = ACCENT, edgePadding = 4.dp, modifier = Modifier.height(28.dp)) {
            EmojiData.categories.forEachIndexed { i, c -> Tab(selected = cat == i, onClick = { cat = i }) { Text(c.icon, fontSize = 14.sp) } }
        }
        LazyVerticalGrid(columns = GridCells.Fixed(8), modifier = Modifier.fillMaxSize().padding(2.dp)) {
            items(EmojiData.categories[cat].emojis) { e ->
                Box(Modifier.height(38.dp).clickable { onPick(e) }, contentAlignment = Alignment.Center) { Text(e, fontSize = 24.sp) }
            }
        }
    }
}

// ══════════════════════════════════════════
// KEYS — Samsung Dark Layout
// ══════════════════════════════════════════

@Composable
private fun KeysContent(
    state: KeyboardState, onKeyPress: (String) -> Unit, onBackspace: () -> Unit,
    onSpace: () -> Unit, onShiftToggle: () -> Unit, onAction: () -> Unit,
) {
    var numMode by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize().padding(horizontal = 3.dp, vertical = 2.dp), verticalArrangement = Arrangement.spacedBy(KEY_GAP_V)) {
        // Number row — always visible
        NumberRow(onKeyPress)

        when (numMode) {
            0 -> LetterKeys(state, onKeyPress, onBackspace, onSpace, onShiftToggle, onAction) { numMode = 1 }
            1 -> SymbolKeys(SYM1_R1, SYM1_R2, SYM1_R3, "½", onKeyPress, onBackspace, onSpace, onAction, { numMode = 2 }) { numMode = 0 }
            2 -> SymbolKeys(SYM2_R1, SYM2_R2, SYM2_R3, "⅔", onKeyPress, onBackspace, onSpace, onAction, { numMode = 1 }) { numMode = 0 }
        }
    }
}

@Composable
private fun NumberRow(onKeyPress: (String) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(KEY_GAP_H)) {
        NUM_ROW.forEach { n -> SamKey(n, Modifier.weight(1f), { onKeyPress(n) }, h = NUM_H, fs = 16.sp) }
    }
}

// ── LETTER KEYS (Samsung QWERTY) ──
@Composable
private fun LetterKeys(
    state: KeyboardState, onKeyPress: (String) -> Unit, onBackspace: () -> Unit,
    onSpace: () -> Unit, onShiftToggle: () -> Unit, onAction: () -> Unit,
    onSymbol: () -> Unit,
) {
    val shift = state.isShiftActive || state.isCapsLock

    // Row 1: QWERTYUIOP
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(KEY_GAP_H)) {
        ALPHA_R1.forEach { k ->
            val display = if (shift) k.uppercase() else k
            SamKey(display, Modifier.weight(1f), { onKeyPress(if (shift) k.uppercase() else k) })
        }
    }

    // Row 2: ASDFGHJKL (centered with padding)
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(KEY_GAP_H)) {
        ALPHA_R2.forEach { k ->
            val display = if (shift) k.uppercase() else k
            SamKey(display, Modifier.weight(1f), { onKeyPress(if (shift) k.uppercase() else k) })
        }
    }

    // Row 3: Shift + ZXCVBNM + Backspace
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(KEY_GAP_H)) {
        // Shift key — 3 states: off, on, locked
        // Shift key — same icon ⇧ for all 3 states, only bg color differs
        val shiftBg = when {
            state.isCapsLock -> ACCENT
            state.isShiftActive -> ACCENT.copy(0.35f)
            else -> KEY_BG_SP
        }
        SamKey("⇧", Modifier.weight(1.5f), onShiftToggle, bg = shiftBg, fw = FontWeight.Bold, fs = 20.sp)

        ALPHA_R3.forEach { k ->
            val display = if (shift) k.uppercase() else k
            SamKey(display, Modifier.weight(1f), { onKeyPress(if (shift) k.uppercase() else k) })
        }

        HoldKey("⌫", Modifier.weight(1.5f), onBackspace, bg = KEY_BG_SP)
    }

    // Row 4: !#1 | $ | spacebar | . | action
    SamsungBottomRow(state, "!#1", onSymbol, onSpace, onKeyPress, onAction)
}

// ── SYMBOL KEYS ──
@Composable
private fun SymbolKeys(
    r1: List<String>, r2: List<String>, r3: List<String>, pageLabel: String,
    onKeyPress: (String) -> Unit, onBackspace: () -> Unit, onSpace: () -> Unit,
    onAction: () -> Unit, onNextPage: () -> Unit, onLetters: () -> Unit,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(KEY_GAP_H)) {
        r1.forEach { k -> SamKey(k, Modifier.weight(1f), { onKeyPress(k) }) }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(KEY_GAP_H)) {
        r2.forEach { k -> SamKey(k, Modifier.weight(1f), { onKeyPress(k) }) }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(KEY_GAP_H)) {
        SamKey(pageLabel, Modifier.weight(1.5f), onNextPage, bg = KEY_BG_SP, fs = 14.sp, fw = FontWeight.SemiBold)
        r3.forEach { k -> SamKey(k, Modifier.weight(1f), { onKeyPress(k) }) }
        HoldKey("⌫", Modifier.weight(1.5f), onBackspace, bg = KEY_BG_SP)
    }
    SamsungBottomRow(state = null, switchLabel = "ABC", onSwitch = onLetters, onSpace = onSpace, onKeyPress = onKeyPress, onAction = onAction)
}

// ── SAMSUNG BOTTOM ROW ──
@Composable
private fun SamsungBottomRow(
    state: KeyboardState?, switchLabel: String, onSwitch: () -> Unit,
    onSpace: () -> Unit, onKeyPress: (String) -> Unit, onAction: () -> Unit,
) {
    val imeAction = state?.imeAction ?: 0
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(KEY_GAP_H)) {
        // Switch key (!#1 or ABC)
        SamKey(switchLabel, Modifier.weight(1.2f), onSwitch, bg = KEY_BG_SP, fs = 14.sp, fw = FontWeight.SemiBold)
        // $ key
        SamKey("$", Modifier.weight(1f), { onKeyPress("$") }, bg = KEY_BG_SP)
        // Spacebar with juskoe branding
        Box(Modifier.weight(4.5f).height(KEY_H)
            .shadow(0.5.dp, RoundedCornerShape(KEY_R)).clip(RoundedCornerShape(KEY_R)).background(KEY_BG)
            .clickable(onClick = onSpace), contentAlignment = Alignment.Center) {
            JuskoeBranding(MUTED, 13.sp)
        }
        // Period
        SamKey(".", Modifier.weight(1f), { onKeyPress(".") }, bg = KEY_BG_SP)
        // Action key (context-aware)
        ActionKey(imeAction, Modifier.weight(1.3f), onAction)
    }
}

// ── ACTION KEY — changes based on IME context ──
@Composable
private fun ActionKey(imeAction: Int, modifier: Modifier, onClick: () -> Unit) {
    val currentOnClick by rememberUpdatedState(onClick)
    val isContextual = imeAction == EditorInfo.IME_ACTION_SEARCH ||
            imeAction == EditorInfo.IME_ACTION_SEND ||
            imeAction == EditorInfo.IME_ACTION_GO ||
            imeAction == EditorInfo.IME_ACTION_DONE
    val bg = if (isContextual) ACCENT else KEY_BG_SP
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (pressed) 0.95f else 1f, tween(40), label = "ak")

    Box(modifier.height(KEY_H).graphicsLayer { scaleX = scale; scaleY = scale }
        .shadow(0.5.dp, RoundedCornerShape(KEY_R)).clip(RoundedCornerShape(KEY_R))
        .background(if (pressed) (if (isContextual) ACCENT.copy(0.7f) else KEY_BG_PRESS) else bg)
        .pointerInput(Unit) { detectTapGestures(onPress = { pressed = true; currentOnClick(); tryAwaitRelease(); pressed = false }) },
        contentAlignment = Alignment.Center) {
        val tint = if (isContextual) Color.White else KEY_TXT
        when (imeAction) {
            EditorInfo.IME_ACTION_SEARCH -> Icon(Icons.Filled.Search, "Search", tint = tint, modifier = Modifier.size(20.dp))
            EditorInfo.IME_ACTION_SEND -> Icon(Icons.AutoMirrored.Filled.Send, "Send", tint = tint, modifier = Modifier.size(20.dp))
            EditorInfo.IME_ACTION_GO -> Text("Go", color = tint, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            EditorInfo.IME_ACTION_DONE -> Icon(Icons.Filled.Done, "Done", tint = tint, modifier = Modifier.size(20.dp))
            else -> Icon(Icons.AutoMirrored.Filled.KeyboardReturn, "Enter", tint = tint, modifier = Modifier.size(20.dp))
        }
    }
}

// ══════════════════════════════════════════
// SAMSUNG KEY — press effect (scale + color)
// ══════════════════════════════════════════

@Composable
private fun SamKey(
    text: String, modifier: Modifier = Modifier, onClick: () -> Unit,
    bg: Color = KEY_BG, tc: Color = KEY_TXT, h: androidx.compose.ui.unit.Dp = KEY_H,
    fs: androidx.compose.ui.unit.TextUnit = 18.sp, fw: FontWeight = FontWeight.Normal,
) {
    val currentOnClick by rememberUpdatedState(onClick)
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (pressed) 0.95f else 1f, tween(40), label = "ks")
    val pressBg = remember(bg) {
        Color(red = (bg.red * 1.5f).coerceAtMost(1f), green = (bg.green * 1.5f).coerceAtMost(1f),
            blue = (bg.blue * 1.5f).coerceAtMost(1f), alpha = bg.alpha)
    }

    Box(modifier.height(h).graphicsLayer { scaleX = scale; scaleY = scale }
        .shadow(0.5.dp, RoundedCornerShape(KEY_R)).clip(RoundedCornerShape(KEY_R))
        .background(if (pressed) pressBg else bg)
        .pointerInput(Unit) { detectTapGestures(onPress = { pressed = true; currentOnClick(); tryAwaitRelease(); pressed = false }) },
        contentAlignment = Alignment.Center) {
        Text(text, color = tc, fontSize = fs, fontWeight = fw, textAlign = TextAlign.Center, fontFamily = FontFamily.SansSerif)
    }
}

// ── Hold-to-repeat (backspace) with progressive speed ──
@Composable
private fun HoldKey(text: String, modifier: Modifier = Modifier, onAction: () -> Unit, bg: Color = KEY_BG) {
    val currentOnAction by rememberUpdatedState(onAction)
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (pressed) 0.95f else 1f, tween(40), label = "hk")
    val pressBg = remember(bg) {
        Color(red = (bg.red * 1.5f).coerceAtMost(1f), green = (bg.green * 1.5f).coerceAtMost(1f),
            blue = (bg.blue * 1.5f).coerceAtMost(1f), alpha = bg.alpha)
    }

    // Progressive backspace: slow start → medium → fast
    // Phase 1 (0-600ms): 100ms repeat = letter by letter, comfortable
    // Phase 2 (600-1500ms): 75ms repeat = word deletion kicks in (service-side)
    // Phase 3 (1500ms+): 60ms repeat = fast multi-word deletion
    LaunchedEffect(pressed) {
        if (pressed) {
            currentOnAction() // first delete immediately
            delay(400L)       // initial hold delay before repeat
            val startMs = System.currentTimeMillis()
            while (pressed) {
                currentOnAction()
                val holdMs = System.currentTimeMillis() - startMs
                val delayMs = when {
                    holdMs < 600 -> 100L   // slow: letter by letter
                    holdMs < 1500 -> 75L   // medium: word by word
                    else -> 60L            // fast: multi-word
                }
                delay(delayMs)
            }
        }
    }

    Box(modifier.height(KEY_H).graphicsLayer { scaleX = scale; scaleY = scale }
        .shadow(0.5.dp, RoundedCornerShape(KEY_R)).clip(RoundedCornerShape(KEY_R))
        .background(if (pressed) pressBg else bg)
        .pointerInput(Unit) { detectTapGestures(onPress = { pressed = true; tryAwaitRelease(); pressed = false }) },
        contentAlignment = Alignment.Center) {
        Text(text, color = KEY_TXT, fontSize = 17.sp, fontFamily = FontFamily.SansSerif)
    }
}

// ── Juskoe branding ──
@Composable
private fun JuskoeBranding(color: Color, size: androidx.compose.ui.unit.TextUnit) {
    Text(buildAnnotatedString {
        withStyle(SpanStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, color = color)) { append("jus") }
        withStyle(SpanStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic, color = color)) { append("koe") }
    }, fontSize = size)
}

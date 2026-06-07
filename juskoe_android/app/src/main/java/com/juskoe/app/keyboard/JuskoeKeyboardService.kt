package com.juskoe.app.keyboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.inputmethodservice.InputMethodService
import android.media.AudioManager
import android.view.inputmethod.EditorInfo
import android.util.Log
import android.view.View
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.juskoe.app.data.AudioRecorder
import com.juskoe.app.data.Config
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.data.VoicePipeline
import com.juskoe.app.ui.theme.JuskoeKeyboardTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * JUSKOE Custom Keyboard (IME Service)
 *
 * Uses Jetpack Compose for the UI by implementing LifecycleOwner,
 * ViewModelStoreOwner, and SavedStateRegistryOwner — all three are
 * REQUIRED for ComposeView to work inside an InputMethodService.
 */
class JuskoeKeyboardService :
    InputMethodService(),
    LifecycleOwner,
    ViewModelStoreOwner,
    SavedStateRegistryOwner {

    companion object {
        private const val TAG = "JuskoeKeyboard"
    }

    // --- Lifecycle plumbing (required for Compose in IME) ---
    private val lifecycleRegistry = LifecycleRegistry(this)
    private val savedStateRegistryController = SavedStateRegistryController.create(this)
    private val store = ViewModelStore()
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override val lifecycle: Lifecycle get() = lifecycleRegistry
    override val viewModelStore: ViewModelStore get() = store
    override val savedStateRegistry: SavedStateRegistry
        get() = savedStateRegistryController.savedStateRegistry

    // Keyboard state
    val keyboardState = mutableStateOf(KeyboardState())

    // Pipeline — lazy init to avoid crashing onCreate
    private var voicePipeline: VoicePipeline? = null
    private var audioRecorder: AudioRecorder? = null

    // Track selected text for AI context
    private var capturedSelectedText: String? = null

    // Progressive backspace tracking
    private var backspaceHoldStartMs = 0L
    private var lastBackspaceMs = 0L

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate: starting keyboard service")

        try {
            savedStateRegistryController.performRestore(null)
            lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_CREATE)
        } catch (e: Exception) {
            Log.e(TAG, "onCreate: lifecycle init failed", e)
        }

        // Set ViewTree owners on the window decorView — CRITICAL for ComposeView
        try {
            val decorView = window?.window?.decorView
            if (decorView != null) {
                decorView.setViewTreeLifecycleOwner(this)
                decorView.setViewTreeViewModelStoreOwner(this)
                decorView.setViewTreeSavedStateRegistryOwner(this)
                Log.d(TAG, "onCreate: ViewTree owners set on decorView")
            } else {
                Log.w(TAG, "onCreate: decorView is null, will set later")
            }
        } catch (e: Exception) {
            Log.e(TAG, "onCreate: failed to set ViewTree on decorView", e)
        }

        // Lazy-init pipeline components (never block service startup)
        serviceScope.launch {
            try {
                voicePipeline = VoicePipeline(this@JuskoeKeyboardService)
                audioRecorder = AudioRecorder(this@JuskoeKeyboardService)
                Log.d(TAG, "onCreate: pipeline initialized")
            } catch (e: Exception) {
                Log.e(TAG, "onCreate: pipeline init failed (non-fatal)", e)
            }

            // Pre-warm STT model in background
            try {
                voicePipeline?.initSTT()
                Log.d(TAG, "onCreate: STT model pre-warmed")
            } catch (e: Exception) {
                Log.e(TAG, "onCreate: STT pre-warm failed (will lazy-init later)", e)
            }

            // Defer credit refresh + old key cleanup
            delay(2000)
            try {
                // Cleanup old date keys (daily reset)
                val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
                val db = com.juskoe.app.data.local.JuskoeDatabase.getInstance(this@JuskoeKeyboardService)
                db.usageCacheDao().deleteOldKeys(today)
                refreshCredits()
            } catch (e: Exception) {
                Log.e(TAG, "onCreate: credit refresh failed (non-fatal)", e)
            }
        }
    }

    override fun onCreateInputView(): View {
        Log.d(TAG, "onCreateInputView: creating keyboard view")

        try {
            lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_START)
            lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_RESUME)
        } catch (e: Exception) {
            Log.e(TAG, "onCreateInputView: lifecycle event failed", e)
        }

        return ComposeView(this).apply {
            setViewTreeLifecycleOwner(this@JuskoeKeyboardService)
            setViewTreeViewModelStoreOwner(this@JuskoeKeyboardService)
            setViewTreeSavedStateRegistryOwner(this@JuskoeKeyboardService)

            setContent {
                JuskoeKeyboardTheme {
                    KeyboardView(
                        state = keyboardState.value,
                        onKeyPress = { key -> handleKeyPress(key) },
                        onModeSwipe = { mode -> handleModeSwipe(mode) },
                        onExpandToggle = { toggleQwerty() },
                        onBackspace = { handleBackspace() },
                        onEnter = { handleEnter() },
                        onSpace = { handleSpace() },
                        onShiftToggle = { toggleShift() },
                        onCancel = { cancelMode() },
                        onDone = { doneMode() },
                        onAction = { handleAction() },
                        onToolClick = { tool -> handleToolClick(tool) },
                        onSuggestionClick = { word -> applySuggestion(word) },
                        onClipboardPaste = { clip -> currentInputConnection?.commitText(clip, 1) },
                        onClipboardToggle = {
                            keyboardState.value = keyboardState.value.copy(
                                showClipboard = !keyboardState.value.showClipboard,
                            )
                        },
                    )
                }
            }
        }
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        val action = info?.imeOptions?.and(EditorInfo.IME_MASK_ACTION) ?: 0
        keyboardState.value = keyboardState.value.copy(imeAction = action)
        checkAutoCapitalize()
    }

    /**
     * Called when the keyboard window is first shown.
     * This is the safest place to set ViewTree owners on decorView
     * because the window is guaranteed to exist here.
     */
    override fun onWindowShown() {
        super.onWindowShown()
        try {
            val decorView = window?.window?.decorView
            if (decorView != null) {
                decorView.setViewTreeLifecycleOwner(this)
                decorView.setViewTreeViewModelStoreOwner(this)
                decorView.setViewTreeSavedStateRegistryOwner(this)
            }
        } catch (e: Exception) {
            Log.e(TAG, "onWindowShown: ViewTree setup failed", e)
        }
    }

    // ============================================
    // Text Input
    // ============================================

    private fun handleKeyPress(key: String) {
        try {
            playKeyClick()
            currentInputConnection?.commitText(key, 1)
            // Auto-deactivate shift after a letter (unless caps lock)
            val s = keyboardState.value
            if (s.isShiftActive && !s.isCapsLock && key.length == 1 && key[0].isLetter()) {
                keyboardState.value = s.copy(isShiftActive = false)
            }
            updateSuggestions()
            checkAutoCapitalize()
        } catch (e: Exception) {
            Log.e(TAG, "handleKeyPress failed", e)
        }
    }

    private fun handleBackspace() {
        try {
            val ic = currentInputConnection ?: return
            // If text is selected, delete the selection
            val sel = ic.getSelectedText(0)
            if (sel != null && sel.isNotEmpty()) {
                ic.commitText("", 1)
                updateSuggestions()
                return
            }

            // Progressive backspace: track hold duration
            val now = System.currentTimeMillis()
            // Auto-reset if >200ms gap since last backspace call (new press)
            if (lastBackspaceMs > 0L && (now - lastBackspaceMs) > 200) {
                backspaceHoldStartMs = now
            } else if (backspaceHoldStartMs == 0L) {
                backspaceHoldStartMs = now
            }
            lastBackspaceMs = now
            val holdMs = now - backspaceHoldStartMs

            when {
                holdMs < 600 -> {
                    // Phase 1: single character delete
                    ic.deleteSurroundingText(1, 0)
                }
                holdMs < 1500 -> {
                    // Phase 2: delete one word at a time
                    deleteWordBackward(ic)
                }
                else -> {
                    // Phase 3: delete 2 words at a time
                    deleteWordBackward(ic)
                    deleteWordBackward(ic)
                }
            }
            updateSuggestions()
            checkAutoCapitalize()
        } catch (e: Exception) {
            Log.e(TAG, "handleBackspace failed", e)
        }
    }

    /** Reset backspace hold tracking */
    fun resetBackspaceHold() {
        backspaceHoldStartMs = 0L
        lastBackspaceMs = 0L
    }

    /** Delete one word backward (space-delimited) */
    private fun deleteWordBackward(ic: android.view.inputmethod.InputConnection) {
        val before = ic.getTextBeforeCursor(50, 0) ?: return
        if (before.isEmpty()) return
        // Trim trailing spaces, then find previous space
        val trimmed = before.trimEnd()
        if (trimmed.isEmpty()) {
            ic.deleteSurroundingText(before.length, 0)
            return
        }
        val lastSpace = trimmed.lastIndexOf(' ')
        val charsToDelete = before.length - (if (lastSpace >= 0) lastSpace + 1 else 0)
        ic.deleteSurroundingText(charsToDelete, 0)
    }

    private fun handleEnter() {
        try {
            playKeyClick()
            currentInputConnection?.commitText("\n", 1)
            keyboardState.value = keyboardState.value.copy(currentWord = "", suggestions = emptyList())
            checkAutoCapitalize()
        } catch (e: Exception) {
            Log.e(TAG, "handleEnter failed", e)
        }
    }

    private var lastSpaceMs = 0L

    private fun handleSpace() {
        try {
            playKeyClick()
            val now = System.currentTimeMillis()
            val ic = currentInputConnection
            // Double-tap space → ". " (standard keyboard behavior)
            if (now - lastSpaceMs < 300 && ic != null) {
                val before = ic.getTextBeforeCursor(1, 0)?.toString()
                if (before == " ") {
                    ic.deleteSurroundingText(1, 0)
                    ic.commitText(". ", 1)
                    lastSpaceMs = 0L
                    keyboardState.value = keyboardState.value.copy(currentWord = "", suggestions = emptyList())
                    checkAutoCapitalize()
                    return
                }
            }
            lastSpaceMs = now
            ic?.commitText(" ", 1)
            keyboardState.value = keyboardState.value.copy(currentWord = "", suggestions = emptyList())
            checkAutoCapitalize()
        } catch (e: Exception) {
            Log.e(TAG, "handleSpace failed", e)
        }
    }

    /** Perform context-aware action (Search/Send/Go/Done/Enter) */
    private fun handleAction() {
        val action = keyboardState.value.imeAction
        val ic = currentInputConnection ?: return
        if (action > 0 && action != EditorInfo.IME_ACTION_UNSPECIFIED) {
            ic.performEditorAction(action)
        } else {
            ic.commitText("\n", 1)
            checkAutoCapitalize()
        }
    }

    // ============================================
    // Voice Mode Handling
    // ============================================

    private fun handleModeSwipe(mode: VoiceMode) {
        val pipeline = voicePipeline ?: return
        val modeStr = when (mode) {
            VoiceMode.AI -> "ai"
            VoiceMode.GRAMMAR -> "grammar"
            VoiceMode.NOTES -> "notes"
            VoiceMode.NONE -> return
        }

        // Capture selected text BEFORE entering voice mode (for AI context)
        capturedSelectedText = try {
            currentInputConnection?.getSelectedText(0)?.toString()?.takeIf { it.isNotBlank() }
        } catch (_: Exception) { null }

        // Pre-recording: reinit STT if language changed & credit check
        serviceScope.launch {
            try {
                // Ensure STT is initialized with latest language preference
                pipeline.initSTT()

                val creditCheck = pipeline.checkCreditsBeforeRecording(modeStr)
                if (!creditCheck.allowed) {
                    keyboardState.value = keyboardState.value.copy(
                        activeMode = mode,
                        voiceState = VoiceState.IDLE,
                        errorMessage = creditCheck.reason,
                    )
                    return@launch
                }

                // Set mode active
                keyboardState.value = keyboardState.value.copy(
                    activeMode = mode,
                    voiceState = VoiceState.READY,
                    errorMessage = null,
                )

                // Auto-start recording immediately (no "press Done" step)
                val rec = audioRecorder
                if (rec != null && rec.hasPermission()) {
                    try {
                        val started = rec.startRecording()
                        if (started) {
                            keyboardState.value = keyboardState.value.copy(
                                voiceState = VoiceState.RECORDING,
                            )
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "handleModeSwipe: auto-start recording failed", e)
                        keyboardState.value = keyboardState.value.copy(
                            errorMessage = "mic access failed",
                        )
                    }
                } else {
                    keyboardState.value = keyboardState.value.copy(
                        errorMessage = "mic permission needed",
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "handleModeSwipe credit check failed", e)
                // Fail-open: allow recording even if check fails
                keyboardState.value = keyboardState.value.copy(
                    activeMode = mode,
                    voiceState = VoiceState.READY,
                    errorMessage = null,
                )
            }
        }
    }

    /**
     * Start voice recording (called on long-press)
     */
    fun startRecording() {
        val recorder = audioRecorder ?: return
        if (keyboardState.value.voiceState != VoiceState.READY) return
        if (!recorder.hasPermission()) return

        try {
            val started = recorder.startRecording()
            if (started) {
                keyboardState.value = keyboardState.value.copy(
                    voiceState = VoiceState.RECORDING,
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "startRecording failed", e)
        }
    }

    /**
     * Stop recording and process through pipeline
     */
    fun stopRecordingAndProcess() {
        val recorder = audioRecorder ?: return
        val pipeline = voicePipeline ?: return
        if (keyboardState.value.voiceState != VoiceState.RECORDING) return

        try {
            val pcmData = recorder.stopRecording()
            keyboardState.value = keyboardState.value.copy(
                voiceState = VoiceState.PROCESSING,
            )

            val modeStr = when (keyboardState.value.activeMode) {
                VoiceMode.AI -> "ai"
                VoiceMode.GRAMMAR -> "grammar"
                VoiceMode.NOTES -> "notes"
                else -> "ai"
            }

            serviceScope.launch {
                try {
                    // Credit gate — check if free user is at limit
                    if (!canUseCredit(modeStr)) {
                        keyboardState.value = keyboardState.value.copy(
                            voiceState = VoiceState.IDLE,
                            activeMode = VoiceMode.NONE,
                            errorMessage = "Daily limit reached. Upgrade to Pro for unlimited.",
                        )
                        return@launch
                    }

                    val result = pipeline.processRecording(pcmData, modeStr)

                    if (result.success && result.processedText != null) {
                        // Apply dict corrections & snippet expansions
                        val finalText = applyDictAndSnippets(result.processedText)

                        // Try to commit text to input field
                        val ic = currentInputConnection
                        val committed = ic?.commitText(finalText, 1) ?: false

                        // Always copy to system clipboard (fallback for non-editable fields)
                        try {
                            val clipboardManager = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboardManager.setPrimaryClip(android.content.ClipData.newPlainText("JUSKOE", finalText))
                        } catch (e: Exception) {
                            Log.e(TAG, "clipboard copy failed", e)
                        }

                        // Save to clipboard history (latest 20)
                        try {
                            val db = com.juskoe.app.data.local.JuskoeDatabase.getInstance(this@JuskoeKeyboardService)
                            db.clipDao().insert(com.juskoe.app.data.local.ClipEntry(text = finalText))
                            db.clipDao().trimOld()
                        } catch (e: Exception) {
                            Log.e(TAG, "clip history save failed", e)
                        }

                        keyboardState.value = keyboardState.value.copy(
                            voiceState = VoiceState.IDLE,
                            activeMode = VoiceMode.NONE,
                            errorMessage = if (!committed) "Copied to clipboard" else null,
                        )
                        // Save to generated content history
                        try {
                            val db = com.juskoe.app.data.local.JuskoeDatabase.getInstance(this@JuskoeKeyboardService)
                            db.generatedContentDao().insert(
                                com.juskoe.app.data.local.GeneratedContentEntry(
                                    mode = modeStr,
                                    input = result.transcript ?: "",
                                    output = result.processedText,
                                )
                            )
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to save generated content", e)
                        }
                        incrementLocalUsage(modeStr)
                        // Also increment on Supabase for cross-device sync
                        if (SupabaseManager.isAuthenticated()) {
                            try { SupabaseManager.checkAndIncrementUsage(modeStr) } catch (_: Exception) {}
                        }
                        refreshCredits()
                    } else {
                        keyboardState.value = keyboardState.value.copy(
                            voiceState = VoiceState.IDLE,
                            errorMessage = result.error ?: "Processing failed",
                        )
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "stopRecordingAndProcess failed", e)
                    keyboardState.value = keyboardState.value.copy(
                        voiceState = VoiceState.IDLE,
                        errorMessage = "Error: ${e.message}",
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "stopRecordingAndProcess failed", e)
        }
    }
    // ============================================
    // Autocomplete & Clipboard
    // ============================================

    private fun updateSuggestions() {
        try {
            val ic = currentInputConnection ?: return
            val before = ic.getTextBeforeCursor(30, 0)?.toString() ?: return
            val lastWord = before.split(Regex("[\\s,.]")).lastOrNull()?.lowercase() ?: ""
            if (lastWord.length < 2) {
                keyboardState.value = keyboardState.value.copy(currentWord = lastWord, suggestions = emptyList())
                return
            }
            val matches = COMMON_WORDS.filter { it.startsWith(lastWord) && it != lastWord }.take(3)
            keyboardState.value = keyboardState.value.copy(currentWord = lastWord, suggestions = matches)
        } catch (_: Exception) {
            keyboardState.value = keyboardState.value.copy(suggestions = emptyList())
        }
    }

    private fun applySuggestion(word: String) {
        try {
            val ic = currentInputConnection ?: return
            val before = ic.getTextBeforeCursor(30, 0)?.toString() ?: ""
            val curWord = before.split(Regex("[\\s,.]")).lastOrNull() ?: ""
            if (curWord.isNotEmpty()) {
                ic.deleteSurroundingText(curWord.length, 0)
            }
            ic.commitText("$word ", 1)
            keyboardState.value = keyboardState.value.copy(currentWord = "", suggestions = emptyList())
        } catch (e: Exception) {
            Log.e(TAG, "applySuggestion failed", e)
        }
    }

    private fun loadClipboard() {
        try {
            val cm = getSystemService(CLIPBOARD_SERVICE) as? android.content.ClipboardManager
            val clip = cm?.primaryClip
            if (clip != null && clip.itemCount > 0) {
                val text = clip.getItemAt(0).text?.toString()
                if (!text.isNullOrBlank()) {
                    val history = keyboardState.value.clipboardHistory.toMutableList()
                    if (!history.contains(text)) {
                        history.add(0, text)
                        if (history.size > 10) history.removeAt(history.lastIndex)
                        keyboardState.value = keyboardState.value.copy(clipboardHistory = history)
                    }
                }
            }
        } catch (_: Exception) {}
    }

    /** Play system key click sound */
    private fun playKeyClick() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            am?.playSoundEffect(AudioManager.FX_KEYPRESS_STANDARD, -1f)
        } catch (_: Exception) {}
    }

    // ============================================
    // Toggle & Credits
    // ============================================

    private fun toggleQwerty() {
        keyboardState.value = keyboardState.value.copy(
            isQwertyExpanded = !keyboardState.value.isQwertyExpanded,
        )
    }

    /** 3-state shift: OFF → ON (one letter) → CAPS LOCK → OFF */
    private fun toggleShift() {
        val s = keyboardState.value
        keyboardState.value = when {
            !s.isShiftActive -> s.copy(isShiftActive = true, isCapsLock = false)
            s.isShiftActive && !s.isCapsLock -> s.copy(isCapsLock = true)
            else -> s.copy(isShiftActive = false, isCapsLock = false)
        }
    }

    /** Auto-capitalize at sentence start, after newline, or at text start */
    private fun checkAutoCapitalize() {
        if (keyboardState.value.isCapsLock) return
        try {
            val ic = currentInputConnection ?: return
            val before = ic.getTextBeforeCursor(2, 0)?.toString()
            val shouldCap = before.isNullOrEmpty() ||
                    before.endsWith(". ") || before.endsWith("! ") || before.endsWith("? ") ||
                    before.endsWith("\n")
            if (shouldCap != keyboardState.value.isShiftActive) {
                keyboardState.value = keyboardState.value.copy(isShiftActive = shouldCap)
            }
        } catch (_: Exception) {}
    }

    // ============================================
    // Cancel / Done Mode
    // ============================================

    private fun cancelMode() {
        keyboardState.value = keyboardState.value.copy(
            activeMode = VoiceMode.NONE,
            voiceState = VoiceState.IDLE,
            errorMessage = null,
        )
        // Stop recording if in progress
        try { audioRecorder?.stopRecording() } catch (_: Exception) {}
    }

    private fun doneMode() {
        val pipeline = voicePipeline ?: return
        val recorder = audioRecorder ?: return
        val mode = keyboardState.value.activeMode
        if (mode == VoiceMode.NONE) return

        val modeStr = when (mode) {
            VoiceMode.AI -> "ai"
            VoiceMode.GRAMMAR -> "grammar"
            VoiceMode.NOTES -> "notes"
            else -> "ai"
        }

        // If not recording yet, start recording briefly then process
        if (keyboardState.value.voiceState == VoiceState.IDLE ||
            keyboardState.value.voiceState == VoiceState.READY
        ) {
            // Start recording
            if (recorder.hasPermission()) {
                try {
                    recorder.startRecording()
                    keyboardState.value = keyboardState.value.copy(
                        voiceState = VoiceState.RECORDING,
                    )
                } catch (e: Exception) {
                    Log.e(TAG, "doneMode: startRecording failed", e)
                    keyboardState.value = keyboardState.value.copy(
                        errorMessage = "mic access failed",
                    )
                }
            } else {
                keyboardState.value = keyboardState.value.copy(
                    errorMessage = "mic permission needed",
                )
            }
            return
        }

        // If currently recording, stop and process
        if (keyboardState.value.voiceState == VoiceState.RECORDING) {
            try {
                val pcmData = recorder.stopRecording()
                keyboardState.value = keyboardState.value.copy(
                    voiceState = VoiceState.PROCESSING,
                )

                serviceScope.launch {
                    try {
                        // Credit gate
                        if (!canUseCredit(modeStr)) {
                            keyboardState.value = keyboardState.value.copy(
                                voiceState = VoiceState.IDLE,
                                activeMode = VoiceMode.NONE,
                                errorMessage = "Daily limit reached. Upgrade to Pro for unlimited.",
                            )
                            return@launch
                        }

                        // If selected text was captured, include it as AI context
                        val result = if (!capturedSelectedText.isNullOrBlank()) {
                            pipeline.processRecordingWithContext(pcmData, modeStr, capturedSelectedText!!)
                        } else {
                            pipeline.processRecording(pcmData, modeStr)
                        }
                        if (result.success && result.processedText != null) {
                            // If we had selected text, replace it with the result
                            if (!capturedSelectedText.isNullOrBlank()) {
                                currentInputConnection?.commitText(result.processedText, 1)
                            } else {
                                currentInputConnection?.commitText(result.processedText, 1)
                            }
                            // Copy result to system clipboard
                            copyToClipboard(result.processedText)
                            capturedSelectedText = null
                            // Save to generated content history (Room)
                            try {
                                val db = com.juskoe.app.data.local.JuskoeDatabase.getInstance(this@JuskoeKeyboardService)
                                db.generatedContentDao().insert(
                                    com.juskoe.app.data.local.GeneratedContentEntry(
                                        mode = modeStr,
                                        input = result.transcript ?: "",
                                        output = result.processedText,
                                    )
                                )
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to save generated content", e)
                            }
                            // Show "juskoe" DONE state for 1.2s
                            keyboardState.value = keyboardState.value.copy(
                                voiceState = VoiceState.DONE,
                                errorMessage = null,
                            )
                            incrementLocalUsage(modeStr)
                            if (SupabaseManager.isAuthenticated()) {
                                try { SupabaseManager.checkAndIncrementUsage(modeStr) } catch (_: Exception) {}
                            }
                            refreshCredits()
                            delay(1200)
                            keyboardState.value = keyboardState.value.copy(
                                activeMode = VoiceMode.NONE,
                                voiceState = VoiceState.IDLE,
                                errorMessage = null,
                            )
                        } else {
                            keyboardState.value = keyboardState.value.copy(
                                voiceState = VoiceState.IDLE,
                                errorMessage = result.error ?: "something's off, try again",
                            )
                            // Auto-clear error after 3s
                            delay(3000)
                            keyboardState.value = keyboardState.value.copy(
                                errorMessage = null,
                                activeMode = VoiceMode.NONE,
                                voiceState = VoiceState.IDLE,
                            )
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "doneMode: process failed", e)
                        keyboardState.value = keyboardState.value.copy(
                            voiceState = VoiceState.IDLE,
                            errorMessage = "nope, got nothing",
                        )
                        delay(3000)
                        keyboardState.value = keyboardState.value.copy(
                            errorMessage = null,
                            activeMode = VoiceMode.NONE,
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "doneMode: stop failed", e)
            }
        }
    }

    // ============================================
    // Tool Click Handlers
    // ============================================

    private fun handleToolClick(tool: String) {
        when (tool) {
            "clipboard" -> {
                loadClipboard()
                keyboardState.value = keyboardState.value.copy(
                    showClipboard = !keyboardState.value.showClipboard,
                )
            }
            "settings" -> {
                // Open keyboard settings
                try {
                    val intent = android.content.Intent(android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS)
                    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                } catch (e: Exception) {
                    Log.e(TAG, "open settings failed", e)
                }
            }
            "language" -> {
                // Show input method picker
                try {
                    val imm = getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
                    imm.showInputMethodPicker()
                } catch (e: Exception) {
                    Log.e(TAG, "language picker failed", e)
                }
            }
        }
    }

    /**
     * Apply dictionary corrections and snippet expansions to text.
     * - Dictionary: replace word → correction (case-insensitive word-level)
     * - Snippets: replace trigger key → expansion content
     */
    private suspend fun applyDictAndSnippets(text: String): String {
        return try {
            val db = com.juskoe.app.data.local.JuskoeDatabase.getInstance(this)
            var result = text

            // Apply dictionary replacements (word → correction)
            val dictEntries = db.dictDao().getAllOnce()
            for (d in dictEntries) {
                if (d.word.isNotBlank()) {
                    result = result.replace(d.word, d.correction, ignoreCase = true)
                }
            }

            // Apply snippet expansions (trigger key → content)
            val snippetEntries = db.snippetDao().getAllOnce()
            for (s in snippetEntries) {
                if (s.key.isNotBlank()) {
                    result = result.replace(s.key, s.content, ignoreCase = true)
                }
            }

            result
        } catch (e: Exception) {
            Log.e(TAG, "applyDictAndSnippets failed", e)
            text // Return original text on error
        }
    }

    /**
     * Credit gate: returns true if the user can use this mode.
     * Pro users (aiCreditsTotal == -1) always pass.
     * Free users are blocked when used >= limit.
     */
    private fun canUseCredit(mode: String): Boolean {
        val state = keyboardState.value
        return when (mode) {
            "ai" -> state.aiCreditsTotal < 0 || state.aiCredits < state.aiCreditsTotal
            "grammar" -> state.grammarCreditsTotal < 0 || state.grammarCredits < state.grammarCreditsTotal
            else -> true  // notes, etc. — no limit
        }
    }

    private suspend fun refreshCredits() {
        try {
            val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
            val db = com.juskoe.app.data.local.JuskoeDatabase.getInstance(this@JuskoeKeyboardService)

            // Always read local usage as baseline
            val localAI = db.usageCacheDao().get("daily_ai_$today")?.value ?: 0
            val localGrammar = db.usageCacheDao().get("daily_grammar_$today")?.value ?: 0

            // Read cached plan (fallback if Supabase fails)
            val prefs = getSharedPreferences("juskoe_settings", Context.MODE_PRIVATE)
            val cachedPlan = prefs.getString("cached_plan", "free") ?: "free"

            if (SupabaseManager.isAuthenticated()) {
                try {
                    val usage = SupabaseManager.getUsageSummary()
                    val profile = try { SupabaseManager.getProfile() } catch (_: Exception) { null }
                    val plan = profile?.plan ?: cachedPlan
                    val isPro = plan == "pro" || plan == "enterprise"

                    // Cache plan locally so it survives network failures
                    if (profile != null) {
                        prefs.edit().putString("cached_plan", plan).apply()
                    }

                    // aiCredits = used count (0→limit), aiCreditsTotal = limit (-1 = ∞)
                    keyboardState.value = keyboardState.value.copy(
                        aiCredits = usage.dailyAI,
                        aiCreditsTotal = if (isPro) -1 else Config.FreePlan.DAILY_AI,
                        grammarCredits = usage.dailyGrammar,
                        grammarCreditsTotal = if (isPro) -1 else Config.FreePlan.DAILY_GRAMMAR,
                    )
                    return
                } catch (e: Exception) {
                    Log.e(TAG, "Supabase credits failed, using local + cached plan", e)
                }
            }

            // Not authenticated OR Supabase failed
            val isPro = cachedPlan == "pro" || cachedPlan == "enterprise"
            keyboardState.value = keyboardState.value.copy(
                aiCredits = localAI,
                aiCreditsTotal = if (isPro) -1 else Config.FreePlan.DAILY_AI,
                grammarCredits = localGrammar,
                grammarCreditsTotal = if (isPro) -1 else Config.FreePlan.DAILY_GRAMMAR,
            )
        } catch (e: Exception) {
            Log.e(TAG, "refreshCredits failed (non-fatal)", e)
        }
    }

    /** Increment local usage counter after a voice use. Call after successful processing. */
    private suspend fun incrementLocalUsage(mode: String) {
        try {
            val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
            val db = com.juskoe.app.data.local.JuskoeDatabase.getInstance(this@JuskoeKeyboardService)
            val key = when (mode) {
                "ai" -> "daily_ai_$today"
                "grammar" -> "daily_grammar_$today"
                else -> return
            }
            val current = db.usageCacheDao().get(key)?.value ?: 0
            db.usageCacheDao().set(com.juskoe.app.data.local.UsageCache(key = key, value = current + 1))
        } catch (e: Exception) {
            Log.e(TAG, "incrementLocalUsage failed (non-fatal)", e)
        }
    }

    /** Copy text to system clipboard */
    private fun copyToClipboard(text: String) {
        try {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("Juskoe output", text))
            Log.d(TAG, "Copied to clipboard: ${text.take(40)}...")
        } catch (e: Exception) {
            Log.e(TAG, "copyToClipboard failed", e)
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy: shutting down")
        try {
            voicePipeline?.release()
            voicePipeline = null
            audioRecorder = null
            serviceScope.cancel()
            lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_DESTROY)
        } catch (e: Exception) {
            Log.e(TAG, "onDestroy cleanup failed", e)
        }
        super.onDestroy()
    }
}

enum class VoiceMode { NONE, AI, GRAMMAR, NOTES }
enum class VoiceState { IDLE, READY, RECORDING, PROCESSING, DONE }

data class KeyboardState(
    val isQwertyExpanded: Boolean = true,
    val activeMode: VoiceMode = VoiceMode.NONE,
    val voiceState: VoiceState = VoiceState.IDLE,
    val isShiftActive: Boolean = false,
    val isCapsLock: Boolean = false,
    val isNumericMode: Boolean = false,
    val imeAction: Int = 0,
    val aiCredits: Int = 0,          // used count (0→limit), count UP
    val aiCreditsTotal: Int = 10,    // -1 = ∞ (pro)
    val grammarCredits: Int = 0,     // used count (0→limit)
    val grammarCreditsTotal: Int = 15, // -1 = ∞ (pro)
    val errorMessage: String? = null,
    val suggestions: List<String> = emptyList(),
    val clipboardHistory: List<String> = emptyList(),
    val showClipboard: Boolean = false,
    val currentWord: String = "",
)

// Top 800+ English words for autocomplete — sorted by frequency
private val COMMON_WORDS = listOf(
    // Ultra-common (top 100)
    "the","be","to","of","and","in","that","have","it","for","not","on","with","he","as","you",
    "do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my",
    "one","all","would","there","their","what","so","up","out","if","about","who","get","which",
    "go","me","when","make","can","like","time","no","just","him","know","take","people","into",
    "year","your","good","some","could","them","see","other","than","then","now","look","only",
    "come","its","over","think","also","back","after","use","two","how","our","work","first",
    "well","way","even","new","want","because","any","these","give","day","most","us","great",
    // Common (100-300)
    "between","need","large","often","around","each","here","help","home","before","through",
    "should","where","much","right","long","very","still","feel","find","more","head","hand",
    "high","place","keep","being","play","last","never","next","old","same","tell","does","set",
    "three","house","under","again","change","went","light","let","thought","might",
    "close","something","school","plant","start","city","earth","every",
    "always","children","point","mother","world","country","follow","really","letter","answer",
    "learn","father","story","important","until","together","got","leave","hello",
    "thanks","thank","sorry","please","okay","sure","welcome","morning","afternoon","evening",
    "night","today","tomorrow","yesterday","happy","beautiful","awesome","amazing","wonderful",
    "message","email","phone","call","meeting","schedule","appointment","address","available",
    "working","project","update","report","review","submit","approve","complete","deadline",
    // Everyday conversation (300-500)
    "going","coming","doing","getting","making","having","taking","looking","saying","giving",
    "thinking","telling","asking","using","trying","leaving","calling","running","moving",
    "waiting","reading","writing","eating","sleeping","talking","walking","playing","living",
    "watching","listening","opening","closing","starting","stopping","turning","pulling",
    "pushing","sending","building","buying","selling","paying","holding","sitting","standing",
    "picking","putting","setting","showing","teaching","learning","spending","bringing",
    "remember","understand","consider","believe","receive","continue","develop","include",
    "provide","different","possible","position","experience","example","company","business",
    "problem","question","system","program","government","number","water","money","family",
    "against","during","without","however","information","already","another","anything",
    "everything","nothing","someone","everyone","actually","probably","certainly","perhaps",
    "finally","quickly","slowly","usually","simply","sometimes","already","enough","rather",
    // Technology & modern (500-650)
    "computer","internet","website","software","application","download","upload","password",
    "account","profile","setting","notification","camera","picture","photo","video","music",
    "screen","device","battery","charger","bluetooth","connect","disconnect","install",
    "keyboard","search","google","youtube","facebook","instagram","twitter","whatsapp",
    "telegram","snapchat","tiktok","spotify","netflix","amazon","online","offline","wifi",
    "mobile","tablet","laptop","desktop","browser","chrome","safari","firefox","android",
    "technology","digital","network","server","database","cloud","storage","backup","security",
    // Emotions & descriptions (650-750)
    "love","like","hate","miss","wish","hope","care","worry","afraid","angry","sad","glad",
    "excited","surprised","confused","tired","hungry","thirsty","sick","hurt","better","worse",
    "perfect","terrible","horrible","fantastic","excellent","incredible","interesting",
    "boring","funny","serious","crazy","weird","strange","normal","special","favorite",
    "little","small","big","huge","tiny","short","tall","fast","slow","strong","weak",
    "easy","hard","difficult","simple","clean","dirty","warm","cool","cold","hot","bright",
    "dark","quiet","loud","soft","rough","smooth","heavy","cheap","expensive","free","full",
    // Time & calendar
    "monday","tuesday","wednesday","thursday","friday","saturday","sunday",
    "january","february","march","april","may","june","july","august",
    "september","october","november","december",
    "week","month","hour","minute","second","later","early","late","soon","recently",
    // Places & travel
    "office","restaurant","hospital","airport","station","market","store","shop","park",
    "street","road","building","room","floor","door","window","kitchen","bathroom","bedroom",
    "outside","inside","nearby","behind","front","above","below","across","along","toward",
    // Food & daily life
    "breakfast","lunch","dinner","coffee","chicken","pizza","sandwich","salad","rice","bread",
    "chocolate","sugar","milk","juice","cheese","butter","fruit","vegetable","meat","fish",
    "clothes","shoes","shirt","pants","dress","jacket","bag","wallet","glasses","watch",
    // Professional
    "manager","employee","customer","client","partner","colleague","boss","team",
    "department","company","organization","industry","market","product","service",
    "contract","agreement","document","budget","payment","invoice","receipt","salary",
    "interview","resume","candidate","qualified","professional","performance","feedback",
    // Polite & conversational
    "absolutely","definitely","obviously","basically","honestly","seriously","literally",
    "appreciate","congratulations","unfortunately","especially","immediately","apparently",
    "recommend","suggestion","agreement","opportunity","responsibility","situation",
    "conversation","relationship","celebration","appreciate","introduce","apology",
    "apologize","forgive","promise","guarantee","confirm","cancel","postpone","reschedule",
)

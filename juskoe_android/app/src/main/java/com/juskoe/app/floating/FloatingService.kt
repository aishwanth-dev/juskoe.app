package com.juskoe.app.floating

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.ColorDrawable
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.juskoe.app.R
import com.juskoe.app.data.AnalyticsManager
import com.juskoe.app.data.AudioRecorder
import com.juskoe.app.data.GeminiService
import com.juskoe.app.data.VoicePipeline
import com.juskoe.app.data.local.JuskoeDatabase
import com.juskoe.app.data.local.NoteEntry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * JUSKOE Cloud overlay service. Hosts the [JuskoeCloudView] in a system overlay
 * window, drives voice workflows (AI / Grammar / Offline / Notes), transforms,
 * and snippets, and inserts results directly via the accessibility service
 * (no clipboard). Caret-aware positioning is fed by [FloatingAccessibilityService].
 */
class FloatingService : Service() {

    companion object {
        private const val TAG = "FloatingService"
        private const val CHANNEL_ID = "juskoe_cloud"
        private const val NOTIF_ID = 1001

        const val MODE_AI = "ai"
        const val MODE_GRAMMAR = "grammar"
        const val MODE_OFFLINE = "offline"
        const val MODE_NOTES = "notes"

        // Auto silence-stop tuning. Background recording yields quieter peaks
        // than foreground; 0.025 reliably detects normal speech without picking
        // up ambient hum (verified by amplitude logging in real-device tests).
        private const val SPEECH_THRESHOLD = 0.025f
        private const val SILENCE_HOLD_MS = 2000L    // stop after this much silence following speech
        private const val NO_SPEECH_TIMEOUT_MS = 6000L // stop if nothing is ever said
        private const val MAX_RECORD_MS = 15000L     // hard cap
        // Watchdog: if the AI step takes longer than this, surface a clear error
        // instead of leaving the cloud stuck in PROCESSING forever.
        private const val PROCESSING_WATCHDOG_MS = 25000L
        // After ERROR, return to IDLE so the next interaction is one tap away.
        private const val ERROR_RESET_MS = 4000L

        @Volatile
        var instance: FloatingService? = null
            private set

        fun start(ctx: Context) {
            val i = Intent(ctx, FloatingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i)
            else ctx.startService(i)
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, FloatingService::class.java))
        }
    }

    private lateinit var wm: WindowManager
    private var cloudView: JuskoeCloudView? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var pipeline: VoicePipeline? = null
    private var recorder: AudioRecorder? = null

    private var recording = false
    private var activeMode = MODE_AI

    // Silence-detection state
    private var silenceJob: Job? = null
    private var lastLoudMs = 0L
    private var speechStarted = false

    // For retry: last audio + mode, and last AI output for transforms.
    private var lastPcm: ByteArray? = null
    private var lastMode: String = MODE_AI
    private var lastOutput: String = ""
    private var lastErrorMsg: String? = null

    // Watchdog that force-exits PROCESSING if the AI hangs.
    private var watchdogJob: Job? = null

    // Highest amplitude seen during the current recording — used for diagnostics
    // when speech detection fails so we can see the actual mic level in logcat.
    private var maxAmpThisTake = 0f

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.d("JUSKOE", "SERVICE_STARTED: FloatingService.onCreate")
        try {
            startAsForeground()
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed — stopping", e)
            stopSelf(); return
        }
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        pipeline = VoicePipeline(this)
        recorder = AudioRecorder(this)
        scope.launch(Dispatchers.IO) { try { pipeline?.initSTT() } catch (_: Exception) {} }
        try {
            ensureAttached()
            Log.d("JUSKOE", "✅ FloatingService created")
        } catch (e: Exception) {
            Log.e(TAG, "ensureAttached failed", e)
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    /**
     * Keep the cloud running in the background even when the user swipes JUSKOE
     * out of recents. Re-issue a start so the foreground service is re-created
     * if the system tears it down with the task.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d("JUSKOE", "onTaskRemoved — keeping cloud alive in background")
        try {
            val restart = Intent(applicationContext, FloatingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(restart)
            } else {
                applicationContext.startService(restart)
            }
        } catch (e: Exception) {
            Log.e("JUSKOE", "onTaskRemoved restart failed", e)
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        instance = null
        try { watchdogJob?.cancel() } catch (_: Exception) {}
        try { silenceJob?.cancel() } catch (_: Exception) {}
        try { cloudView?.let { wm.removeView(it) } } catch (_: Exception) {}
        try { recorder?.stopRecording() } catch (_: Exception) {}
        try { pipeline?.release() } catch (_: Exception) {}
        try { scope.cancel() } catch (_: Exception) {}
        cloudView = null; pipeline = null; recorder = null
        super.onDestroy()
    }

    // ── Overlay window ──

    /** Build overlay LayoutParams for the given window [type]. */
    private fun buildLayoutParams(type: Int): WindowManager.LayoutParams =
        WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            // Default safe position (top-right area) until a caret is tracked.
            x = resources.displayMetrics.widthPixels - dpToPx(56) - dpToPx(8)
            y = dpToPx(120)
        }

    /**
     * Ensure the cloud view is created and attached to a SYSTEM window so it can
     * float over every app (WhatsApp, Chrome, Gmail, …). Uses
     * TYPE_ACCESSIBILITY_OVERLAY — drawn by the active accessibility service, so
     * it needs no "draw over other apps" permission — and falls back to
     * TYPE_APPLICATION_OVERLAY (SYSTEM_ALERT_WINDOW) if that fails.
     * Safe to call repeatedly; it no-ops when already attached.
     */
    private fun ensureAttached() {
        if (cloudView != null && cloudView?.windowToken != null) return

        val cloud = cloudView ?: JuskoeCloudView(this).apply {
            interactionListener = object : JuskoeCloudView.CloudInteractionListener {
                override fun onSingleTap() = handleCloudSingleTap()
                override fun onDoubleTap() = handleCloudDoubleTap()
                override fun onLongPress() = handleCloudLongPress()
                override fun onRetry() = handleRetry()
            }
            alpha = 0f // hidden until an editable field is focused
        }
        cloudView = cloud

        // Primary: accessibility overlay (no overlay permission needed, system-wide).
        val accType = WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
        try {
            wm.addView(cloud, buildLayoutParams(accType))
            Log.d("OVERLAY", "cloud attached (TYPE_ACCESSIBILITY_OVERLAY)")
            return
        } catch (e: Exception) {
            Log.e("OVERLAY", "accessibility-overlay attach failed: ${e.message} — falling back")
        }

        // Fallback: application overlay (requires SYSTEM_ALERT_WINDOW grant).
        val fallbackType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
        try {
            wm.addView(cloud, buildLayoutParams(fallbackType))
            Log.d("OVERLAY", "cloud attached (fallback type=$fallbackType)")
        } catch (e: Exception) {
            Log.e("OVERLAY", "fallback attach failed: ${e.message}")
            cloudView = null
        }
    }

    /**
     * Show the cloud at an absolute screen position computed by the accessibility
     * service (top-right of the focused field). Moves only when the position
     * actually changes (no jitter) and fades in if currently hidden.
     */
    fun showCloudAt(x: Int, y: Int) {
        ensureAttached()
        val cloud = cloudView ?: return
        val lp = cloud.layoutParams as? WindowManager.LayoutParams ?: return
        if (lp.x != x || lp.y != y) {
            lp.x = x; lp.y = y
            safeUpdateViewLayout(cloud, lp)
            Log.d("OVERLAY", "showCloudAt x=$x y=$y")
        }
        if (cloud.alpha < 0.5f) {
            cloud.animate().alpha(1f).setDuration(150).start()
            Log.d("OVERLAY", "cloud shown")
        }
    }

    /** Fade the cloud in at its current position (used by diagnostics screen). */
    fun showCloud() {
        ensureAttached()
        val cloud = cloudView ?: return
        if (cloud.alpha < 0.5f) {
            Log.d("OVERLAY", "showCloud (current position)")
            cloud.animate().alpha(1f).setDuration(150).start()
        }
    }

    fun hideCloud() {
        val cloud = cloudView ?: return
        // Don't hide mid-interaction (recording / processing / showing a result).
        if (recording || cloud.getCurrentState() != JuskoeCloudView.CloudState.IDLE) return
        if (cloud.alpha > 0.5f) {
            Log.d("OVERLAY", "hideCloud")
            cloud.animate().alpha(0f).setDuration(150).start()
        }
    }

    /** updateViewLayout that survives a stale/removed window token by re-attaching. */
    private fun safeUpdateViewLayout(view: View, params: WindowManager.LayoutParams) {
        try {
            wm.updateViewLayout(view, params)
        } catch (e: Exception) {
            Log.e("OVERLAY", "updateViewLayout failed: ${e.message} — re-attaching")
            try { wm.removeView(view) } catch (_: Exception) {}
            cloudView = null
            ensureAttached()
            try {
                cloudView?.let { wm.updateViewLayout(it, it.layoutParams as WindowManager.LayoutParams) }
            } catch (_: Exception) {}
        }
    }

    // ── Interaction handlers ──

    private fun handleCloudSingleTap() {
        if (recording) stopListeningAndProcess() else startListening(MODE_AI)
    }

    private fun handleCloudDoubleTap() {
        if (recording) stopListeningAndProcess() else startListening(MODE_GRAMMAR)
    }

    private fun handleRetry() {
        val pcm = lastPcm ?: return
        Log.d("RETRY", "retry triggered (mode=$lastMode)")
        cloudView?.hideRetry()
        cloudView?.setState(JuskoeCloudView.CloudState.PROCESSING)
        startProcessingWatchdog(lastMode)
        scope.launch { runAndDeliver(pcm, lastMode, replace = true) }
    }

    // ── Voice workflow ──

    private fun startListening(mode: String) {
        val rec = recorder ?: return
        if (!rec.hasPermission()) {
            Toast.makeText(this, "Enable mic permission in the JUSKOE app", Toast.LENGTH_SHORT).show()
            return
        }
        activeMode = mode
        Log.d("JUSKOE", "AI_MODE_SELECTED: $mode")
        // Snapshot the focused field now — a tap on the cloud can blur it, and we
        // need a reliable insertion target when the AI result returns.
        try { FloatingAccessibilityService.instance?.captureTarget() } catch (_: Exception) {}
        // Pre-warm the Supabase session in the background so the AI call has a
        // fresh JWT even if JUSKOE has been backgrounded for a long time.
        scope.launch(Dispatchers.IO) {
            try { com.juskoe.app.data.SupabaseManager.refreshSession() } catch (_: Exception) {}
        }
        cloudView?.setState(JuskoeCloudView.CloudState.LISTENING)
        cloudView?.setOfflineBadge(mode == MODE_OFFLINE || !isNetworkAvailable())
        // Silence-detection state: track speech + the last loud frame.
        speechStarted = false
        maxAmpThisTake = 0f
        lastLoudMs = System.currentTimeMillis()
        rec.amplitudeListener = { amp ->
            if (amp > maxAmpThisTake) maxAmpThisTake = amp
            if (amp >= SPEECH_THRESHOLD) {
                speechStarted = true
                lastLoudMs = System.currentTimeMillis()
            }
            scope.launch { cloudView?.setAmplitude(amp) }
        }
        val started = try { rec.startRecording() } catch (_: Exception) { false }
        if (started) {
            recording = true
            startSilenceMonitor()
        } else {
            recording = false
            Log.e("JUSKOE", "ERROR_STAGE=AUDIO ERROR_MESSAGE=startRecording failed (mic init/permission)")
            cloudView?.setState(JuskoeCloudView.CloudState.ERROR)
        }
    }

    /**
     * Auto-stop on ~2s of silence after speech (no manual second tap). Falls back
     * to a no-speech timeout and a hard max-duration cap.
     */
    private fun startSilenceMonitor() {
        silenceJob?.cancel()
        silenceJob = scope.launch {
            val startMs = System.currentTimeMillis()
            while (recording) {
                delay(200)
                val now = System.currentTimeMillis()
                when {
                    speechStarted && now - lastLoudMs >= SILENCE_HOLD_MS -> {
                        Log.d("JUSKOE", "Auto-stop: silence ${SILENCE_HOLD_MS}ms after speech")
                        stopListeningAndProcess(); break
                    }
                    !speechStarted && now - startMs >= NO_SPEECH_TIMEOUT_MS -> {
                        Log.d("JUSKOE", "Auto-stop: no speech within ${NO_SPEECH_TIMEOUT_MS}ms")
                        stopListeningAndProcess(); break
                    }
                    now - startMs >= MAX_RECORD_MS -> {
                        Log.d("JUSKOE", "Auto-stop: max record ${MAX_RECORD_MS}ms")
                        stopListeningAndProcess(); break
                    }
                }
            }
        }
    }

    private fun stopListeningAndProcess() {
        val rec = recorder ?: return
        if (!recording) return
        recording = false
        silenceJob?.cancel()
        rec.amplitudeListener = null
        val pcm = try { rec.stopRecording() } catch (_: Exception) { null } ?: return
        // Diagnose background-mic problems: 16kHz/16-bit mono → 32 bytes/ms.
        val durationMs = pcm.size / 32
        Log.d("JUSKOE", "AUDIO_CAPTURED: bytes=${pcm.size} (~${durationMs}ms) maxAmp=${"%.3f".format(maxAmpThisTake)} speechDetected=$speechStarted")
        if (pcm.size < 1600 || !speechStarted) {
            // Effectively no audio — almost always a blocked background mic.
            Log.e("JUSKOE", "ERROR_STAGE=AUDIO ERROR_MESSAGE=no audio captured (bytes=${pcm.size}, maxAmp=${"%.3f".format(maxAmpThisTake)})")
            lastPcm = pcm; lastMode = activeMode
            cloudView?.setState(JuskoeCloudView.CloudState.ERROR)
            cloudView?.showRetry()
            scheduleErrorReset()
            Toast.makeText(this, "No audio captured (mic level=${"%.2f".format(maxAmpThisTake)}) — try speaking louder or open JUSKOE once to refresh mic", Toast.LENGTH_LONG).show()
            return
        }
        lastPcm = pcm; lastMode = activeMode
        cloudView?.setState(JuskoeCloudView.CloudState.PROCESSING)
        startProcessingWatchdog(activeMode)
        scope.launch { runAndDeliver(pcm, activeMode) }
    }

    /** Force-exit PROCESSING after [PROCESSING_WATCHDOG_MS] so the cloud never gets stuck. */
    private fun startProcessingWatchdog(mode: String) {
        watchdogJob?.cancel()
        watchdogJob = scope.launch {
            delay(PROCESSING_WATCHDOG_MS)
            if (cloudView?.getCurrentState() == JuskoeCloudView.CloudState.PROCESSING) {
                Log.e("JUSKOE", "ERROR_STAGE=WATCHDOG ERROR_MESSAGE=AI did not respond within ${PROCESSING_WATCHDOG_MS}ms mode=$mode")
                cloudView?.setState(JuskoeCloudView.CloudState.ERROR)
                cloudView?.showRetry()
                Toast.makeText(this@FloatingService, "AI took too long — check network and try again", Toast.LENGTH_LONG).show()
                scheduleErrorReset()
            }
        }
    }

    /** Reset ERROR → IDLE so the user can interact again without restarting. */
    private fun scheduleErrorReset() {
        scope.launch {
            delay(ERROR_RESET_MS)
            if (cloudView?.getCurrentState() == JuskoeCloudView.CloudState.ERROR) {
                cloudView?.setState(JuskoeCloudView.CloudState.IDLE)
            }
        }
    }

    /** Run STT/AI for [mode] off the main thread, then deliver + set cloud state. */
    private suspend fun runAndDeliver(pcm: ByteArray, mode: String, replace: Boolean = false) {
        lastErrorMsg = null
        val output = try { runMode(pcm, mode) } catch (e: Exception) {
            lastErrorMsg = e.message
            Log.e("JUSKOE", "ERROR_STAGE=PIPELINE ERROR_MESSAGE=${e.message}", e)
            null
        }
        watchdogJob?.cancel() // result arrived (or didn't) — stop the watchdog
        if (output.isNullOrBlank()) {
            val reason = lastErrorMsg ?: "No output"
            Log.e("JUSKOE", "🔴 RED_CLOUD reason=\"$reason\" mode=$mode")
            cloudView?.setState(JuskoeCloudView.CloudState.ERROR)
            cloudView?.showRetry() // let the user retry the whole pipeline
            AnalyticsManager.trackError("cloud", "no_output_$mode")
            Toast.makeText(this, reason, Toast.LENGTH_LONG).show()
            scheduleErrorReset()
            return
        }
        if (mode != MODE_NOTES) lastOutput = output
        val inserted = deliver(output, replace = replace)
        if (!inserted) {
            Log.e("JUSKOE", "ERROR_STAGE=INSERTION ERROR_MESSAGE=insert failed; output kept on clipboard")
        }
        if (inserted) {
            cloudView?.setState(JuskoeCloudView.CloudState.SUCCESS)
            cloudView?.showRetry() // tapping retry regenerates a variation in place
        } else {
            cloudView?.setState(JuskoeCloudView.CloudState.ERROR)
            cloudView?.showRetry()
            scheduleErrorReset()
        }
    }

    private suspend fun runMode(pcm: ByteArray, mode: String): String? {
        val p = pipeline ?: run { lastErrorMsg = "Pipeline not ready"; return null }
        return when (mode) {
            MODE_NOTES -> {
                val t = p.transcribeForNote(pcm)
                if (t.isBlank()) { lastErrorMsg = "No speech detected"; null } else { saveNote(t); t }
            }
            MODE_OFFLINE -> {
                val t = p.transcribeForNote(pcm)
                if (t.isBlank()) { lastErrorMsg = "No speech detected"; null } else "$t (offline)"
            }
            else -> {
                val r = p.processRecording(pcm, mode)
                if (r.success) {
                    r.processedText
                } else {
                    lastErrorMsg = r.error
                    Log.e("JUSKOE", "ERROR_STAGE=PIPELINE ERROR_MESSAGE=${r.error}")
                    null
                }
            }
        }
    }

    private suspend fun saveNote(text: String) {
        try {
            JuskoeDatabase.getInstance(this).noteDao().insert(NoteEntry(text = text))
            AnalyticsManager.trackNoteCreated()
        } catch (e: Exception) {
            Log.e(TAG, "saveNote failed", e)
        }
    }

    /** Explicit user action (long-press menu) to keep the last AI output as a note. */
    private fun saveLastOutputToNote() {
        val text = lastOutput
        if (text.isBlank()) {
            Toast.makeText(this, "Nothing to save yet", Toast.LENGTH_SHORT).show()
            return
        }
        scope.launch {
            saveNote(text)
            Toast.makeText(this@FloatingService, "Saved to Notes", Toast.LENGTH_SHORT).show()
        }
    }

    // ── Transforms (operate on the last AI output) ──

    private fun transformLastOutput(promptPrefix: String) {
        if (lastOutput.isBlank()) {
            Toast.makeText(this, "Generate something first, then transform it", Toast.LENGTH_SHORT).show()
            return
        }
        cloudView?.setState(JuskoeCloudView.CloudState.PROCESSING)
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                GeminiService.processVoiceInput("$promptPrefix\n\n$lastOutput", MODE_AI)
            }
            if (result.isSuccess) {
                val out = result.getOrThrow()
                lastOutput = out
                val inserted = deliver(out)
                cloudView?.setState(if (inserted) JuskoeCloudView.CloudState.SUCCESS else JuskoeCloudView.CloudState.ERROR)
            } else {
                cloudView?.setState(JuskoeCloudView.CloudState.ERROR)
                AnalyticsManager.trackError("cloud", "transform_failed")
            }
        }
    }

    // ── Direct insertion (NO clipboard) ──

    /** Insert via accessibility. Returns true if inserted into a focused field. */
    private fun deliver(text: String, replace: Boolean = false): Boolean {
        val acc = FloatingAccessibilityService.instance
        Log.d("JUSKOE", "INSERTION_STARTED: len=${text.length}, replace=$replace, accessibility=${acc != null}")
        val ok = if (replace) acc?.replaceText(text) ?: false else acc?.insertText(text) ?: false
        Log.d("JUSKOE", "INSERTION_COMPLETED: result=$ok")
        if (!ok) {
            // Never lose the generated text — fall back to clipboard so the user can paste.
            try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                cm?.setPrimaryClip(android.content.ClipData.newPlainText("JUSKOE", text))
                Toast.makeText(
                    this,
                    "Couldn't type here — copied to clipboard, long-press the field to paste",
                    Toast.LENGTH_LONG,
                ).show()
            } catch (e: Exception) {
                Log.e("JUSKOE", "ERROR_STAGE=INSERTION clipboard fallback failed", e)
            }
            AnalyticsManager.trackError("insertion", if (acc == null) "accessibility_unavailable" else "insert_failed")
        }
        return ok
    }

    // ── Long-press menu ──

    private fun handleCloudLongPress() {
        val cloud = cloudView ?: return
        val items: List<Pair<String, () -> Unit>> = listOf(
            "AI Mode" to { startListening(MODE_AI) },
            "Grammar Mode" to { startListening(MODE_GRAMMAR) },
            "Offline Mode" to { startListening(MODE_OFFLINE) },
            "Rewrite" to { transformLastOutput("Rewrite this more clearly and professionally:") },
            "Snippets" to { showSnippetsSubmenu() },
            "Professional" to { transformLastOutput("Make this message sound professional:") },
            "Friendly" to { transformLastOutput("Make this message sound friendly and warm:") },
            "Shorter" to { transformLastOutput("Shorten this message while keeping the key points:") },
            "Longer" to { transformLastOutput("Expand this message with more detail:") },
            "Translate" to { transformLastOutput("Translate this to English:") },
            "Save to Notes" to { saveLastOutputToNote() },
            "Settings" to { openSettings() },
            "Exit" to { stopSelf() },
        )
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
            setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8))
        }
        lateinit var popup: PopupWindow
        for ((label, action) in items) {
            content.addView(TextView(this).apply {
                text = label
                setTextColor(Color.parseColor("#202020"))
                textSize = 15f
                setPadding(dpToPx(20), dpToPx(12), dpToPx(20), dpToPx(12))
                setOnClickListener { popup.dismiss(); action() }
            })
        }
        popup = PopupWindow(content, dpToPx(200), LinearLayout.LayoutParams.WRAP_CONTENT, true).apply {
            setBackgroundDrawable(ColorDrawable(Color.WHITE))
            elevation = dpToPx(12).toFloat()
        }
        try { popup.showAsDropDown(cloud, 0, -cloud.height - dpToPx(8)) } catch (_: Exception) {}
    }

    private fun showSnippetsSubmenu() {
        val cloud = cloudView ?: return
        scope.launch {
            val snippets = withContext(Dispatchers.IO) {
                try { JuskoeDatabase.getInstance(this@FloatingService).snippetDao().getAllOnce() }
                catch (_: Exception) { emptyList() }
            }
            if (snippets.isEmpty()) {
                Toast.makeText(this@FloatingService, "No snippets saved yet", Toast.LENGTH_SHORT).show()
                return@launch
            }
            val content = LinearLayout(this@FloatingService).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(Color.WHITE)
                setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8))
            }
            lateinit var popup: PopupWindow
            for (s in snippets) {
                content.addView(TextView(this@FloatingService).apply {
                    text = if (s.title.isNotBlank()) s.title else s.key
                    setTextColor(Color.parseColor("#202020"))
                    textSize = 15f
                    setPadding(dpToPx(20), dpToPx(12), dpToPx(20), dpToPx(12))
                    setOnClickListener { popup.dismiss(); deliver(s.content) }
                })
            }
            popup = PopupWindow(content, dpToPx(240), LinearLayout.LayoutParams.WRAP_CONTENT, true).apply {
                setBackgroundDrawable(ColorDrawable(Color.WHITE))
                elevation = dpToPx(12).toFloat()
            }
            try { popup.showAsDropDown(cloud, 0, -cloud.height - dpToPx(8)) } catch (_: Exception) {}
        }
    }

    private fun openSettings() {
        try {
            startActivity(
                Intent(this, com.juskoe.app.ui.MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (e: Exception) {
            Log.e(TAG, "openSettings failed", e)
        }
    }

    // ── Helpers ──

    private fun isNetworkAvailable(): Boolean {
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val n = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(n) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (_: Exception) { false }
    }

    private fun getStatusBarHeight(): Int {
        val id = resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (id > 0) resources.getDimensionPixelSize(id) else 0
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()

    private fun startAsForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(NotificationManager::class.java)
            if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "JUSKOE Cloud", NotificationManager.IMPORTANCE_MIN)
                )
            }
        }
        val notif = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("JUSKOE Cloud active")
            .setContentText("Your AI assistant is beside your cursor")
            .setSmallIcon(R.drawable.juskoe_logo)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }
}

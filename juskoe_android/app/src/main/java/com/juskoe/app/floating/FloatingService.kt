package com.juskoe.app.floating

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
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
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
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

    // For retry: last audio + mode, and last AI output for transforms.
    private var lastPcm: ByteArray? = null
    private var lastMode: String = MODE_AI
    private var lastOutput: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
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
            addCloud()
            Log.d("JUSKOE", "✅ FloatingService created")
        } catch (e: Exception) {
            Log.e(TAG, "addCloud failed", e)
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        instance = null
        try { cloudView?.let { wm.removeView(it) } } catch (_: Exception) {}
        try { recorder?.stopRecording() } catch (_: Exception) {}
        try { pipeline?.release() } catch (_: Exception) {}
        try { scope.cancel() } catch (_: Exception) {}
        cloudView = null; pipeline = null; recorder = null
        super.onDestroy()
    }

    // ── Overlay window ──

    private fun addCloud() {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            // Default safe position (top-right area) until a caret is tracked.
            x = resources.displayMetrics.widthPixels - dpToPx(56) - dpToPx(8)
            y = dpToPx(120)
        }

        val cloud = JuskoeCloudView(this).apply {
            interactionListener = object : JuskoeCloudView.CloudInteractionListener {
                override fun onSingleTap() = handleCloudSingleTap()
                override fun onDoubleTap() = handleCloudDoubleTap()
                override fun onLongPress() = handleCloudLongPress()
                override fun onRetry() = handleRetry()
            }
        }
        cloudView = cloud
        wm.addView(cloud, lp)
    }

    /** Reposition the cloud to top-right of the caret/field; called by accessibility. */
    fun positionCloud(caretX: Float, caretY: Float, fieldRect: Rect) {
        val cloud = cloudView ?: return
        val size = dpToPx(JuskoeCloudView.CLOUD_SIZE_DP)
        val margin = dpToPx(12)
        val screenW = resources.displayMetrics.widthPixels
        val screenH = resources.displayMetrics.heightPixels
        val statusBar = getStatusBarHeight()

        var x = caretX + margin
        var y = caretY - size - margin
        if (y < statusBar + dpToPx(8)) y = caretY + margin            // not enough space above → below
        if (x + size > screenW - dpToPx(8)) x = (screenW - size - dpToPx(8)).toFloat()
        if (x < dpToPx(4)) x = dpToPx(4).toFloat()
        if (y + size > screenH - dpToPx(8)) y = (screenH - size - dpToPx(8)).toFloat()
        if (y < statusBar) y = statusBar.toFloat()

        val lp = cloud.layoutParams as? WindowManager.LayoutParams ?: return
        lp.x = x.toInt(); lp.y = y.toInt()
        try {
            wm.updateViewLayout(cloud, lp)
            Log.d("JUSKOE", "☁️ Cloud at (${lp.x}, ${lp.y}) for caret ($caretX, $caretY)")
        } catch (_: Exception) {}
    }

    fun showCloud() {
        val cloud = cloudView ?: return
        if (cloud.alpha < 0.5f) cloud.animate().alpha(1f).setDuration(150).start()
    }

    fun hideCloud() {
        val cloud = cloudView ?: return
        // Don't hide mid-interaction.
        if (recording || cloud.getCurrentState() != JuskoeCloudView.CloudState.IDLE) return
        if (cloud.alpha > 0.5f) cloud.animate().alpha(0f).setDuration(150).start()
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
        cloudView?.setState(JuskoeCloudView.CloudState.PROCESSING)
        scope.launch { runAndDeliver(pcm, lastMode) }
    }

    // ── Voice workflow ──

    private fun startListening(mode: String) {
        val rec = recorder ?: return
        if (!rec.hasPermission()) {
            Toast.makeText(this, "Enable mic permission in the JUSKOE app", Toast.LENGTH_SHORT).show()
            return
        }
        activeMode = mode
        Log.d("JUSKOE", "🎤 Starting $mode mode")
        cloudView?.setState(JuskoeCloudView.CloudState.LISTENING)
        cloudView?.setOfflineBadge(mode == MODE_OFFLINE || !isNetworkAvailable())
        rec.amplitudeListener = { amp -> scope.launch { cloudView?.setAmplitude(amp) } }
        val started = try { rec.startRecording() } catch (_: Exception) { false }
        if (started) {
            recording = true
        } else {
            recording = false
            cloudView?.setState(JuskoeCloudView.CloudState.ERROR)
        }
    }

    private fun stopListeningAndProcess() {
        val rec = recorder ?: return
        if (!recording) return
        recording = false
        rec.amplitudeListener = null
        val pcm = try { rec.stopRecording() } catch (_: Exception) { null } ?: return
        lastPcm = pcm; lastMode = activeMode
        cloudView?.setState(JuskoeCloudView.CloudState.PROCESSING)
        scope.launch { runAndDeliver(pcm, activeMode) }
    }

    /** Run STT/AI for [mode] off the main thread, then deliver + set cloud state. */
    private suspend fun runAndDeliver(pcm: ByteArray, mode: String) {
        val output = try { runMode(pcm, mode) } catch (e: Exception) {
            Log.e(TAG, "runMode failed", e); null
        }
        if (output.isNullOrBlank()) {
            cloudView?.setState(JuskoeCloudView.CloudState.ERROR)
            AnalyticsManager.trackError("cloud", "no_output_$mode")
            return
        }
        if (mode != MODE_NOTES) lastOutput = output
        val inserted = deliver(output)
        cloudView?.setState(
            if (inserted) JuskoeCloudView.CloudState.SUCCESS else JuskoeCloudView.CloudState.ERROR
        )
    }

    private suspend fun runMode(pcm: ByteArray, mode: String): String? {
        val p = pipeline ?: return null
        return when (mode) {
            MODE_NOTES -> {
                val t = p.transcribeForNote(pcm)
                if (t.isBlank()) null else { saveNote(t); t }
            }
            MODE_OFFLINE -> {
                val t = p.transcribeForNote(pcm)
                if (t.isBlank()) null else "$t (offline)"
            }
            else -> {
                val r = p.processRecording(pcm, mode)
                if (r.success) r.processedText else null
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
    private fun deliver(text: String): Boolean {
        val acc = FloatingAccessibilityService.instance
        if (acc == null) {
            Toast.makeText(
                this,
                "Enable JUSKOE Cloud in Accessibility settings for direct insertion",
                Toast.LENGTH_LONG,
            ).show()
            AnalyticsManager.trackError("insertion", "accessibility_unavailable")
            return false
        }
        val ok = acc.insertText(text)
        Log.d("JUSKOE", "📝 insertText result=$ok, length=${text.length}")
        if (!ok) AnalyticsManager.trackError("insertion", "no_focused_field")
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

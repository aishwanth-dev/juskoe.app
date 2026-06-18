package com.juskoe.app.floating

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.juskoe.app.R
import com.juskoe.app.data.AudioRecorder
import com.juskoe.app.data.VoicePipeline
import com.juskoe.app.data.local.JuskoeDatabase
import com.juskoe.app.data.local.NoteEntry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * Float JUSKOE — a draggable overlay button that works over ANY app/keyboard.
 * Tap to expand into AI / Grammar / Notes. Tap a mode to start recording, tap
 * again to stop and process. Result is inserted via the accessibility service
 * (falling back to the clipboard) and, for Notes, saved to the Notes table.
 */
class FloatingService : Service() {

    companion object {
        private const val TAG = "FloatingService"
        private const val CHANNEL_ID = "juskoe_float"
        private const val NOTIF_ID = 1001

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
    private var rootView: View? = null
    private var params: WindowManager.LayoutParams? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var pipeline: VoicePipeline? = null
    private var recorder: AudioRecorder? = null

    private var panel: LinearLayout? = null
    private var statusText: TextView? = null
    private var expanded = false
    private var recording = false
    private var activeMode = "ai"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        try {
            startAsForeground()
        } catch (e: Exception) {
            // On Android 14+ a microphone FGS can't start without RECORD_AUDIO.
            // Degrade gracefully instead of crashing.
            Log.e(TAG, "startForeground failed — stopping Float service", e)
            stopSelf()
            return
        }
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        pipeline = VoicePipeline(this)
        recorder = AudioRecorder(this)
        scope.launch(Dispatchers.IO) { try { pipeline?.initSTT() } catch (_: Exception) {} }
        try {
            addOverlay()
        } catch (e: Exception) {
            Log.e(TAG, "addOverlay failed", e)
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    private fun startAsForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(NotificationManager::class.java)
            if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "Float JUSKOE", NotificationManager.IMPORTANCE_MIN)
                )
            }
        }
        val notif = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Float JUSKOE active")
            .setContentText("Tap the floating button to dictate anywhere")
            .setSmallIcon(R.drawable.juskoe_logo)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun addOverlay() {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 0
            y = dp(280)
        }
        params = lp

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.END
        }

        val panelView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            setBackgroundColor(0xEE1B1B1B.toInt())
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        val status = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 12f
            text = "Choose a mode"
        }
        panelView.addView(status)
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(modeButton("AI", "ai"))
        row.addView(modeButton("G", "grammar"))
        row.addView(modeButton("N", "notes"))
        panelView.addView(row)

        val icon = ImageView(this).apply {
            setImageResource(R.drawable.juskoe_logo)
            val s = dp(52)
            layoutParams = LinearLayout.LayoutParams(s, s)
        }
        setupDragAndTap(icon, lp)

        root.addView(panelView)
        root.addView(icon)

        rootView = root
        panel = panelView
        statusText = status
        wm.addView(root, lp)
    }

    private fun modeButton(label: String, mode: String): Button =
        Button(this).apply {
            text = label
            setOnClickListener { onModeTap(mode) }
        }

    private fun setupDragAndTap(view: View, lp: WindowManager.LayoutParams) {
        var initX = 0
        var initY = 0
        var touchX = 0f
        var touchY = 0f
        var moved = false
        view.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    initX = lp.x; initY = lp.y
                    touchX = e.rawX; touchY = e.rawY
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (e.rawX - touchX).toInt()
                    val dy = (e.rawY - touchY).toInt()
                    if (abs(dx) > dp(8) || abs(dy) > dp(8)) moved = true
                    lp.x = initX + dx
                    lp.y = initY + dy
                    try { wm.updateViewLayout(rootView, lp) } catch (_: Exception) {}
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) toggleExpand()
                    true
                }
                else -> false
            }
        }
    }

    private fun toggleExpand() {
        expanded = !expanded
        panel?.visibility = if (expanded) View.VISIBLE else View.GONE
        if (!expanded && recording) {
            // Cancel an in-progress recording when collapsing.
            try { recorder?.stopRecording() } catch (_: Exception) {}
            recording = false
        }
    }

    private fun onModeTap(mode: String) {
        if (!recording) {
            activeMode = mode
            if (recorder?.hasPermission() != true) {
                statusText?.text = "Enable mic permission in the JUSKOE app"
                return
            }
            val started = try { recorder?.startRecording() ?: false } catch (_: Exception) { false }
            if (started) {
                recording = true
                statusText?.text = "● Listening… tap ${labelFor(mode)} to stop"
            } else {
                statusText?.text = "Mic unavailable"
            }
        } else {
            recording = false
            val pcm = try { recorder?.stopRecording() } catch (_: Exception) { null } ?: return
            statusText?.text = "Processing…"
            scope.launch {
                val text = process(pcm, activeMode)
                if (!text.isNullOrBlank()) {
                    deliver(text)
                    statusText?.text = "Done ✓"
                } else {
                    statusText?.text = "Nothing captured — try again"
                }
                delay(1300)
                expanded = false
                panel?.visibility = View.GONE
                statusText?.text = "Choose a mode"
            }
        }
    }

    private fun labelFor(mode: String) = when (mode) {
        "ai" -> "AI"; "grammar" -> "G"; "notes" -> "N"; else -> "mode"
    }

    private suspend fun process(pcm: ByteArray, mode: String): String? {
        val p = pipeline ?: return null
        return if (mode == "notes") {
            val t = p.transcribeForNote(pcm)
            if (t.isBlank()) null else { saveNote(t); t }
        } else {
            val r = p.processRecording(pcm, mode)
            if (r.success) r.processedText else null
        }
    }

    private suspend fun saveNote(text: String) {
        try {
            JuskoeDatabase.getInstance(this).noteDao().insert(NoteEntry(text = text))
        } catch (e: Exception) {
            Log.e(TAG, "saveNote failed", e)
        }
    }

    private fun deliver(text: String) {
        // Always copy to clipboard as a reliable fallback.
        try {
            val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("JUSKOE", text))
        } catch (_: Exception) {}
        // Try to insert directly into the focused field via accessibility.
        val injected = try {
            FloatingAccessibilityService.instance?.insertText(text) ?: false
        } catch (_: Exception) { false }
        if (!injected) {
            Toast.makeText(this, "Copied — long-press the field to paste", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        try { rootView?.let { wm.removeView(it) } } catch (_: Exception) {}
        try { pipeline?.release() } catch (_: Exception) {}
        try { scope.cancel() } catch (_: Exception) {}
        rootView = null
        pipeline = null
        recorder = null
        super.onDestroy()
    }
}

package com.juskoe.app.floating

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Accessibility service for JUSKOE Cloud:
 *  - Tracks the focused editable field's caret/bounds to position the cloud.
 *  - Inserts AI-generated text directly into the focused field (no clipboard).
 * It does not read or log content beyond what is needed for these two tasks.
 */
class FloatingAccessibilityService : AccessibilityService() {

    private var lastCaretUpdateMs = 0L
    private val caretThrottleMs = 50L

    override fun onServiceConnected() {
        try {
            instance = this
            Log.d("JUSKOE", "SERVICE_CONNECTED: AccessibilityService (api=${Build.VERSION.SDK_INT})")
        } catch (e: Exception) {
            Log.e("JUSKOE", "onServiceConnected error", e)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Hard guarantee: never let an exception escape — that is what triggers
        // Android's "This service is malfunctioning" and disables the service.
        try {
            event ?: return
            when (event.eventType) {
                AccessibilityEvent.TYPE_VIEW_FOCUSED,
                AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED,
                AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED,
                AccessibilityEvent.TYPE_VIEW_SCROLLED,
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> onFocusAndPositionChanged(event)
                else -> return
            }
        } catch (e: Exception) {
            Log.e("JUSKOE", "onAccessibilityEvent error (recovered)", e)
        }
    }

    /**
     * Unified handler: find the currently focused editable field, validate it,
     * and either reposition + show the cloud beside it or hide the cloud when
     * focus is lost (e.g. window changed to a non-editable surface).
     */
    private fun onFocusAndPositionChanged(event: AccessibilityEvent) {
        Log.d("JUSKOE", "EVENT_RECEIVED: type=${event.eventType} pkg=${event.packageName}")

        // Always refresh the root — a stale node yields wrong bounds.
        val root = try { rootInActiveWindow } catch (_: Exception) { null }
        val focused = try {
            root?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        } catch (_: Exception) { null }

        val rect = Rect()
        if (focused != null) {
            try { focused.getBoundsInScreen(rect) } catch (_: Exception) {}
        }

        // Valid target = editable, focused, with real on-screen bounds.
        val valid = focused != null && focused.isEditable && focused.isFocused && !rect.isEmpty()
        if (!valid) {
            Log.d("JUSKOE", "FIELD_LOST: no valid editable focus (event=${event.eventType})")
            FloatingService.instance?.hideCloud()
            return
        }

        // Throttle high-frequency events (text/selection/scroll) but never the
        // first focus event for a field.
        val now = System.currentTimeMillis()
        val isHighFreq = event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED ||
            event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED ||
            event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED
        if (isHighFreq && now - lastCaretUpdateMs < caretThrottleMs) return
        lastCaretUpdateMs = now

        // Anchor to the field's top-right edge. Per-character caret pixel position
        // is not reliably exposed by AccessibilityNodeInfo, so anchoring to the
        // field edge is the robust choice (vs. the old char-count estimate that
        // overshot horizontally on long/wrapped text).
        val anchorX = rect.right.toFloat()
        val anchorY = rect.top.toFloat()
        Log.d("JUSKOE", "CARET: field=${rect.toShortString()} anchor=($anchorX,$anchorY) pkg=${event.packageName}")
        FloatingService.instance?.positionCloud(anchorX, anchorY, rect)
        FloatingService.instance?.showCloud()
    }

    override fun onInterrupt() { /* no-op */ }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    /**
     * Insert [text] into the focused editable node (appending to existing text).
     * Returns false if there is no editable focus.
     */
    fun insertText(text: String): Boolean {
        return try {
            Log.d("JUSKOE", "INSERTION_REQUESTED: len=${text.length}")
            val root = rootInActiveWindow ?: return false
            val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
            if (!focused.isEditable) return false

            // Strategy 1: ACTION_SET_TEXT (append to existing content).
            val existing = try { focused.text?.toString() ?: "" } catch (_: Exception) { "" }
            val args = Bundle().apply {
                putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    existing + text,
                )
            }
            if (focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                Log.d("JUSKOE", "✅ insertText via ACTION_SET_TEXT (len=${text.length})")
                return true
            }

            // Strategy 2: clipboard + ACTION_PASTE, then RESTORE the user's clipboard
            // so JUSKOE never pollutes what the user had copied.
            try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                if (cm != null) {
                    val original = try { cm.primaryClip } catch (_: Exception) { null }
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("JUSKOE", text))
                    val pasted = focused.performAction(AccessibilityNodeInfo.ACTION_PASTE)
                    // Restore shortly after the paste is consumed.
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        try {
                            if (original != null) cm.setPrimaryClip(original)
                            else cm.setPrimaryClip(android.content.ClipData.newPlainText("", ""))
                        } catch (_: Exception) {}
                    }, 500)
                    if (pasted) {
                        Log.d("JUSKOE", "✅ insertText via ACTION_PASTE (clipboard restored)")
                        return true
                    }
                }
            } catch (e: Exception) {
                Log.e("JUSKOE", "ACTION_PASTE strategy failed", e)
            }

            Log.w("JUSKOE", "❌ insertText: all strategies failed")
            false
        } catch (e: Exception) {
            Log.e("JUSKOE", "insertText error", e)
            false
        }
    }

    companion object {
        @Volatile
        var instance: FloatingAccessibilityService? = null
            private set

        fun isRunning(): Boolean = instance != null
    }
}

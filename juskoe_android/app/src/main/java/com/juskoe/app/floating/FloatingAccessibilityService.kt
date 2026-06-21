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
            Log.d("JUSKOE", "✅ AccessibilityService connected (api=${Build.VERSION.SDK_INT})")
        } catch (e: Exception) {
            Log.e("JUSKOE", "onServiceConnected error", e)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Hard guarantee: never let an exception escape — that is what triggers
        // Android's "This service is malfunctioning" and disables the service.
        try {
            event ?: return
            if (event.eventType != AccessibilityEvent.TYPE_VIEW_FOCUSED &&
                event.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED &&
                event.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED
            ) return

            val focused = try {
                rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            } catch (_: Exception) { null }

            if (focused == null || !focused.isEditable) {
                FloatingService.instance?.hideCloud()
                return
            }

            val now = System.currentTimeMillis()
            if (now - lastCaretUpdateMs < caretThrottleMs) return
            lastCaretUpdateMs = now

            val rect = Rect()
            focused.getBoundsInScreen(rect)
            val estimatedTextSize = 16f * resources.displayMetrics.density
            // Caret index: prefer the selection-change event's toIndex (accurate),
            // then the node's selection end, then end-of-text.
            val evtCaret = if (event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED) {
                try { event.toIndex } catch (_: Exception) { -1 }
            } else -1
            val selEnd = try { focused.textSelectionEnd } catch (_: Exception) { -1 }
            val charCount = try { focused.text?.length ?: 0 } catch (_: Exception) { 0 }
            val pos = when {
                evtCaret >= 0 -> evtCaret
                selEnd >= 0 -> selEnd
                else -> charCount
            }
            // X near the caret column, clamped inside the field.
            val caretX: Float = (rect.left + pos * estimatedTextSize * 0.5f)
                .coerceIn(rect.left.toFloat(), rect.right.toFloat())
            val caretY = rect.top.toFloat()
            Log.d("JUSKOE", "📍 Caret ~($caretX, $caretY) pkg=${event.packageName} field=${rect.toShortString()}")
            FloatingService.instance?.positionCloud(caretX, caretY, rect)
            FloatingService.instance?.showCloud()
        } catch (e: Exception) {
            Log.e("JUSKOE", "onAccessibilityEvent error (recovered)", e)
        }
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

            // Strategy 2: clipboard + ACTION_PASTE (works in many WebView/RN/Flutter fields).
            try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                cm?.setPrimaryClip(android.content.ClipData.newPlainText("JUSKOE", text))
                if (focused.performAction(AccessibilityNodeInfo.ACTION_PASTE)) {
                    Log.d("JUSKOE", "✅ insertText via ACTION_PASTE")
                    return true
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

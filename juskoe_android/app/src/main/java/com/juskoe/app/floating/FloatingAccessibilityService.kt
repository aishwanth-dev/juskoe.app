package com.juskoe.app.floating

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Bundle
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
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        if (event.eventType != AccessibilityEvent.TYPE_VIEW_FOCUSED &&
            event.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
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

        try {
            val rect = Rect()
            focused.getBoundsInScreen(rect)
            // AccessibilityNodeInfo has no textSize property; use a reasonable default.
            val estimatedTextSize = 16f * resources.displayMetrics.density // ~16sp in px
            val selEnd = focused.textSelectionEnd // API 18+ (minSdk 26 is safe)
            val caretX: Float = if (selEnd > 0 && focused.text != null) {
                (rect.left + selEnd * estimatedTextSize * 0.45f).coerceAtMost(rect.right.toFloat())
            } else {
                rect.right.toFloat()
            }
            val caretY = rect.top.toFloat()
            FloatingService.instance?.positionCloud(caretX, caretY, rect)
            FloatingService.instance?.showCloud()
        } catch (_: Exception) {
            // Positioning is best-effort; never crash on a layout query.
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
            val existing = focused.text?.toString() ?: ""
            val args = Bundle().apply {
                putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    existing + text,
                )
            }
            focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        } catch (e: Exception) {
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

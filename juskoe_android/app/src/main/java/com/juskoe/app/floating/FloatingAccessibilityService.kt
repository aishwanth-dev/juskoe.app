package com.juskoe.app.floating

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Lightweight accessibility service used ONLY to insert text into whatever
 * editable field currently has input focus, so Float JUSKOE works with ANY
 * keyboard. It does not read or log content — it only writes on demand.
 */
class FloatingAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) { /* no-op */ }

    override fun onInterrupt() { /* no-op */ }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    /**
     * Insert [text] into the focused editable node (appending to existing text).
     * Returns false if there is no editable focus, so the caller can fall back
     * to the clipboard.
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

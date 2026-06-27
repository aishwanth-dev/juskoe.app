package com.juskoe.app.floating

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Accessibility service for JUSKOE Cloud:
 *  - Tracks the focused editable field and computes where the cloud should sit
 *    beside it, then drives [FloatingService] visibility/position.
 *  - Inserts AI-generated text directly into the focused field, with multiple
 *    fallback strategies, and supports retry-with-replacement.
 * It never reads or logs field content beyond what these two tasks require.
 */
class FloatingAccessibilityService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())

    private var lastUpdateMs = 0L
    private val throttleMs = 50L

    // Track the last insertion so retry can replace (not duplicate) it.
    private var lastInsertedText: String = ""
    private var lastInsertionStart: Int = -1

    override fun onServiceConnected() {
        try {
            instance = this
            Log.d("SERVICE", "AccessibilityService connected (api=${Build.VERSION.SDK_INT})")
            // Make sure the overlay service is alive whenever accessibility is on.
            try {
                val i = Intent(this, FloatingService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(i)
                else startService(i)
            } catch (e: Exception) {
                Log.e("SERVICE", "could not start FloatingService from accessibility", e)
            }
        } catch (e: Exception) {
            Log.e("SERVICE", "onServiceConnected error", e)
        }
    }

    // ── Event handling ──

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Never let an exception escape — that triggers Android's
        // "service is malfunctioning" and disables the service.
        try {
            event ?: return
            when (event.eventType) {
                AccessibilityEvent.TYPE_VIEW_FOCUSED,
                AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED,
                AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED,
                AccessibilityEvent.TYPE_VIEW_SCROLLED,
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ->
                    handleFocusAndPositionChange(event)
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ->
                    handleWindowStateChange()
                else -> {}
            }
        } catch (e: Exception) {
            Log.e("ACCESSIBILITY", "onAccessibilityEvent error (recovered)", e)
        }
    }

    private fun handleFocusAndPositionChange(event: AccessibilityEvent) {
        Log.d("ACCESSIBILITY", "event=${event.eventType} pkg=${event.packageName}")
        val node = findFocusedEditable()
        if (node == null) {
            hideCloud("no focused editable node")
            return
        }
        try { evaluateAndPosition(node, event.eventType) } finally { recycle(node) }
    }

    /** Window changed (app switch / screen transition) — re-check after it settles. */
    private fun handleWindowStateChange() {
        handler.postDelayed({
            try {
                val node = findFocusedEditable()
                if (node == null) {
                    hideCloud("window changed, no editable focus")
                } else {
                    try { evaluateAndPosition(node, AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) }
                    finally { recycle(node) }
                }
            } catch (e: Exception) {
                Log.e("ACCESSIBILITY", "handleWindowStateChange error", e)
            }
        }, 200)
    }

    /** Find the focused, editable input node in the active window, or null. */
    private fun findFocusedEditable(): AccessibilityNodeInfo? {
        val root = try { rootInActiveWindow } catch (_: Exception) { null } ?: return null
        try { root.refresh() } catch (_: Exception) {}
        val focused = try { root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) } catch (_: Exception) { null }
            ?: return null
        return if (focused.isEditable && focused.isFocused) focused else { recycle(focused); null }
    }

    private fun evaluateAndPosition(node: AccessibilityNodeInfo, eventType: Int) {
        val bounds = Rect()
        node.getBoundsInScreen(bounds)
        if (bounds.isEmpty || bounds.width() == 0 || bounds.height() == 0) {
            hideCloud("invalid field bounds")
            return
        }

        // Throttle the chatty events; never throttle the first focus.
        val now = System.currentTimeMillis()
        val highFreq = eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED ||
            eventType == AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED ||
            eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED ||
            eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
        if (highFreq && now - lastUpdateMs < throttleMs) return
        lastUpdateMs = now

        val (x, y) = computeCloudPosition(bounds)
        Log.d("CARET", "field=${bounds.toShortString()} → cloud x=$x y=$y")
        FloatingService.instance?.showCloudAt(x, y)
    }

    /**
     * Anchor the cloud to the field's top-right corner, just above the field
     * when there is room (else just below), clamped fully on-screen. Per-character
     * caret pixels are not reliably exposed by AccessibilityNodeInfo, so the field
     * edge is the robust anchor.
     */
    private fun computeCloudPosition(bounds: Rect): Pair<Int, Int> {
        val dm = resources.displayMetrics
        val density = dm.density
        val screenW = dm.widthPixels
        val screenH = dm.heightPixels
        val touch = (CLOUD_TOUCH_SIZE_DP * density).toInt()
        val margin = (CLOUD_MARGIN_DP * density).toInt()
        val statusBar = getStatusBarHeight()

        var x = bounds.right - touch - margin
        var y = bounds.top - touch - margin
        if (y < statusBar + margin) y = bounds.bottom + margin // no room above → below

        if (x < margin) x = margin
        if (x + touch > screenW - margin) x = screenW - touch - margin
        if (y < statusBar + margin) y = statusBar + margin
        if (y + touch > screenH - margin) y = screenH - touch - margin
        return Pair(x, y)
    }

    private fun hideCloud(reason: String) {
        Log.d("OVERLAY", "hideCloud: $reason")
        FloatingService.instance?.hideCloud()
    }

    private fun getStatusBarHeight(): Int {
        val id = resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (id > 0) resources.getDimensionPixelSize(id) else 0
    }

    private fun recycle(node: AccessibilityNodeInfo?) {
        try { node?.recycle() } catch (_: Exception) {}
    }

    override fun onInterrupt() { /* no-op */ }

    override fun onDestroy() {
        if (instance === this) instance = null
        Log.w("SERVICE", "AccessibilityService destroyed")
        super.onDestroy()
    }

    // ── Insertion ──

    /**
     * Insert [text] into the focused editable node, appending to existing content.
     * Tries ACTION_SET_TEXT, then clipboard + ACTION_PASTE (restoring the user's
     * clipboard). Records the inserted range so [replaceText] can later swap it.
     * Returns false if there is no editable focus or all strategies fail.
     */
    fun insertText(text: String): Boolean {
        return try {
            Log.d("INSERTION", "INSERTION_STARTED: len=${text.length}")
            val node = findFocusedEditable() ?: run {
                Log.e("INSERTION", "no editable focused node")
                return false
            }
            try {
                val existing = try { node.text?.toString() ?: "" } catch (_: Exception) { "" }

                // Strategy 1: ACTION_SET_TEXT (append).
                val combined = existing + text
                val setArgs = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, combined)
                }
                if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, setArgs)) {
                    lastInsertedText = text
                    lastInsertionStart = existing.length
                    // Place caret at the end so the user can keep typing/send.
                    try {
                        val sel = Bundle().apply {
                            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, combined.length)
                            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, combined.length)
                        }
                        node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, sel)
                    } catch (_: Exception) {}
                    Log.d("INSERTION", "INSERTION_COMPLETED via ACTION_SET_TEXT (start=${existing.length})")
                    return true
                }

                // Strategy 2: clipboard + ACTION_PASTE, then restore the clipboard.
                if (tryPasteWithClipboardRestore(node, text)) {
                    lastInsertedText = text
                    lastInsertionStart = existing.length
                    Log.d("INSERTION", "INSERTION_COMPLETED via ACTION_PASTE")
                    return true
                }

                Log.w("INSERTION", "all in-field strategies failed")
                false
            } finally {
                recycle(node)
            }
        } catch (e: Exception) {
            Log.e("INSERTION", "insertText error", e)
            false
        }
    }

    /**
     * Regeneration: replace the text previously inserted by JUSKOE with [newText],
     * leaving any text the user typed themselves untouched. Falls back to a plain
     * append when the previous range can't be confidently located.
     */
    fun replaceText(newText: String): Boolean {
        return try {
            val node = findFocusedEditable() ?: run {
                Log.e("RETRY", "no editable node for replacement — appending instead")
                return insertText(newText)
            }
            try {
                val full = try { node.text?.toString() ?: "" } catch (_: Exception) { "" }
                val start = lastInsertionStart
                val oldLen = lastInsertedText.length
                val canReplace = start in 0..full.length &&
                    start + oldLen <= full.length &&
                    full.substring(start, start + oldLen) == lastInsertedText &&
                    oldLen > 0
                if (!canReplace) {
                    Log.d("RETRY", "previous range not found — appending new text")
                    recycle(node)
                    return insertText(newText)
                }
                val rebuilt = full.substring(0, start) + newText + full.substring(start + oldLen)
                val args = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, rebuilt)
                }
                if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                    lastInsertedText = newText
                    // start unchanged; caret to end of replacement
                    try {
                        val caret = start + newText.length
                        val sel = Bundle().apply {
                            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, caret)
                            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, caret)
                        }
                        node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, sel)
                    } catch (_: Exception) {}
                    Log.d("RETRY", "text replaced (start=$start oldLen=$oldLen newLen=${newText.length})")
                    return true
                }
                recycle(node)
                insertText(newText)
            } finally {
                recycle(node)
            }
        } catch (e: Exception) {
            Log.e("RETRY", "replaceText error", e)
            false
        }
    }

    private fun tryPasteWithClipboardRestore(node: AccessibilityNodeInfo, text: String): Boolean {
        return try {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                ?: return false
            val original = try { cm.primaryClip } catch (_: Exception) { null }
            cm.setPrimaryClip(android.content.ClipData.newPlainText("JUSKOE", text))
            val pasted = node.performAction(AccessibilityNodeInfo.ACTION_PASTE)
            handler.postDelayed({
                try {
                    if (original != null) cm.setPrimaryClip(original)
                    else cm.setPrimaryClip(android.content.ClipData.newPlainText("", ""))
                } catch (_: Exception) {}
            }, 500)
            pasted
        } catch (e: Exception) {
            Log.e("INSERTION", "ACTION_PASTE strategy failed", e)
            false
        }
    }

    companion object {
        const val CLOUD_TOUCH_SIZE_DP = 56f
        const val CLOUD_MARGIN_DP = 14f

        @Volatile
        var instance: FloatingAccessibilityService? = null
            private set

        fun isRunning(): Boolean = instance != null
    }
}

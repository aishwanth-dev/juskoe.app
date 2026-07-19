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
 *  - Tracks the focused editable field (across every app + window) and tells
 *    [FloatingService] where to place the cloud.
 *  - Inserts AI text directly into that field, re-focusing it and writing at the
 *    caret, with clipboard paste + clipboard fallbacks. Supports retry-replace.
 * It never reads or logs field content beyond what these two tasks require.
 */
class FloatingAccessibilityService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())

    private var lastUpdateMs = 0L
    private val throttleMs = 50L

    // Track the last insertion so retry can replace (not duplicate) it.
    private var lastInsertedText: String = ""
    private var lastInsertionStart: Int = -1

    // Field captured at the moment the user starts an interaction (definitely
    // focused then) — used as an insertion fallback if a tap blurs the field.
    @Volatile
    private var capturedTarget: AccessibilityNodeInfo? = null

    override fun onServiceConnected() {
        try {
            instance = this
            Log.d("SERVICE", "AccessibilityService connected (api=${Build.VERSION.SDK_INT})")
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
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> updateCloudPosition(event.eventType)
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ->
                    handler.postDelayed({
                        try { updateCloudPosition(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) }
                        catch (e: Exception) { Log.e("ACCESSIBILITY", "delayed position error", e) }
                    }, 200)
                else -> {}
            }
        } catch (e: Exception) {
            Log.e("ACCESSIBILITY", "onAccessibilityEvent error (recovered)", e)
        }
    }

    /** Recompute the cloud position from the *current* focused editable field. */
    private fun updateCloudPosition(eventType: Int) {
        // Throttle chatty events; never throttle focus / window changes.
        val now = System.currentTimeMillis()
        val highFreq = eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED ||
            eventType == AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED ||
            eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED ||
            eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
        if (highFreq && now - lastUpdateMs < throttleMs) return
        lastUpdateMs = now

        val node = resolveEditableTarget()
        if (node == null) {
            FloatingService.instance?.hideCloud()
            return
        }
        try {
            try { node.refresh() } catch (_: Exception) {} // fresh bounds (post-keyboard layout)
            val bounds = Rect()
            node.getBoundsInScreen(bounds)
            if (bounds.isEmpty || bounds.width() == 0 || bounds.height() == 0) {
                Log.d("CARET", "invalid bounds — hiding")
                FloatingService.instance?.hideCloud()
                return
            }
            val (x, y) = computeCloudPosition(bounds)
            Log.d("CARET", "field=${bounds.toShortString()} editable=${node.isEditable} → cloud x=$x y=$y")
            FloatingService.instance?.showCloudAt(x, y)
        } finally {
            recycle(node)
        }
    }

    /**
     * Find the focused editable field, searching the active window first and then
     * every interactive window (the field is frequently NOT in rootInActiveWindow,
     * e.g. when an IME/dialog window is active). Caller must [recycle] the result.
     */
    private fun resolveEditableTarget(): AccessibilityNodeInfo? {
        // 1) Active window input focus.
        try {
            val root = rootInActiveWindow
            if (root != null) {
                try { root.refresh() } catch (_: Exception) {}
                val f = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
                if (f != null && f.isEditable && f.isFocused) return f
                recycle(f)
            }
        } catch (_: Exception) {}

        // 2) Any interactive window: input focus, then a deep search for a focused editable.
        try {
            for (w in windows) {
                val root = try { w.root } catch (_: Exception) { null } ?: continue
                val f = try { root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) } catch (_: Exception) { null }
                if (f != null && f.isEditable && f.isFocused) return f
                recycle(f)
                val deep = findFocusedEditable(root)
                if (deep != null) return deep
            }
        } catch (_: Exception) {}
        return null
    }

    /** Depth-first search for an editable + focused node. */
    private fun findFocusedEditable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        node ?: return null
        try {
            if (node.isEditable && node.isFocused) return node
            for (i in 0 until node.childCount) {
                val child = try { node.getChild(i) } catch (_: Exception) { null } ?: continue
                val r = findFocusedEditable(child)
                if (r != null) return r
                if (child !== node) recycle(child)
            }
        } catch (_: Exception) {}
        return null
    }

    /**
     * Anchor the cloud to the field's top-right corner, just above the field when
     * there is room (else just below), clamped fully on-screen. Per-character caret
     * pixels are not reliably exposed, so the field edge is the robust anchor.
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

    private fun getStatusBarHeight(): Int {
        val id = resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (id > 0) resources.getDimensionPixelSize(id) else 0
    }

    private fun recycle(node: AccessibilityNodeInfo?) {
        try { node?.recycle() } catch (_: Exception) {}
    }

    /** Recycle a node unless it is the long-lived captured target. */
    private fun recycleIfNotCaptured(node: AccessibilityNodeInfo?) {
        if (node != null && node !== capturedTarget) recycle(node)
    }

    /** Snapshot the focused field at interaction start (it's definitely focused then). */
    fun captureTarget() {
        try {
            val n = resolveEditableTarget()
            val old = capturedTarget
            capturedTarget = n
            if (old != null && old !== n) recycle(old)
            Log.d("INSERTION", "captureTarget: ${if (n != null) "captured" else "none"}")
        } catch (e: Exception) {
            Log.e("INSERTION", "captureTarget error", e)
        }
    }

    /** Live focused editable, else the captured field (refreshed) if focus was lost. */
    private fun insertionTarget(): AccessibilityNodeInfo? {
        val live = resolveEditableTarget()
        if (live != null) return live
        val cap = capturedTarget ?: return null
        return try {
            if (cap.refresh() && cap.isEditable) {
                Log.d("INSERTION", "using captured target (live focus lost)")
                cap
            } else null
        } catch (_: Exception) { null }
    }

    override fun onInterrupt() { /* no-op */ }

    override fun onUnbind(intent: Intent?): Boolean {
        Log.d("SERVICE", "AccessibilityService onUnbind")
        return true
    }

    override fun onDestroy() {
        try { FloatingService.instance?.hideCloud() } catch (_: Exception) {}
        if (instance === this) instance = null
        Log.w("SERVICE", "AccessibilityService destroyed")
        super.onDestroy()
    }

    // ── Insertion ──

    /**
     * Insert [text] into the focused editable field at the caret. Re-focuses the
     * field first (taps to the cloud can blur it), writes via ACTION_SET_TEXT, and
     * falls back to clipboard + ACTION_PASTE (restoring the user's clipboard).
     * Records the inserted range so [replaceText] can later swap it.
     * Returns false only if no editable field can be found or every strategy fails.
     */
    fun insertText(text: String): Boolean {
        return try {
            Log.d("INSERTION", "INSERTION_STARTED: len=${text.length}")
            val node = insertionTarget() ?: run {
                Log.e("INSERTION", "no editable field found in any window")
                return false
            }
            try {
                // Re-focus: a tap on the floating cloud can momentarily blur the field.
                try { node.performAction(AccessibilityNodeInfo.ACTION_FOCUS) } catch (_: Exception) {}

                val existing = try { node.text?.toString() ?: "" } catch (_: Exception) { "" }
                // Write at the caret/selection (replacing any selected range).
                val selS = node.textSelectionStart
                val selE = node.textSelectionEnd
                val start = if (selS in 0..existing.length) selS else existing.length
                val end = if (selE in start..existing.length) selE else start
                val combined = existing.substring(0, start) + text + existing.substring(end)
                val caret = start + text.length

                val setArgs = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, combined)
                }
                if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, setArgs)) {
                    lastInsertedText = text
                    lastInsertionStart = start
                    setCaret(node, caret)
                    Log.d("INSERTION", "INSERTION_COMPLETED via ACTION_SET_TEXT (start=$start)")
                    return true
                }

                if (tryPasteWithClipboardRestore(node, text)) {
                    lastInsertedText = text
                    lastInsertionStart = start
                    Log.d("INSERTION", "INSERTION_COMPLETED via ACTION_PASTE")
                    return true
                }

                Log.w("INSERTION", "all in-field strategies failed (editable=${node.isEditable})")
                false
            } finally {
                recycleIfNotCaptured(node)
            }
        } catch (e: Exception) {
            Log.e("INSERTION", "insertText error", e)
            false
        }
    }

    /**
     * Regeneration: replace the text previously inserted by JUSKOE with [newText],
     * leaving any user-typed text untouched. Falls back to a normal insert when the
     * previous range can't be confidently located.
     */
    fun replaceText(newText: String): Boolean {
        return try {
            val node = insertionTarget() ?: run {
                Log.e("RETRY", "no editable field — appending instead")
                return insertText(newText)
            }
            try {
                try { node.performAction(AccessibilityNodeInfo.ACTION_FOCUS) } catch (_: Exception) {}
                val full = try { node.text?.toString() ?: "" } catch (_: Exception) { "" }
                val start = lastInsertionStart
                val oldLen = lastInsertedText.length
                val canReplace = start in 0..full.length &&
                    start + oldLen <= full.length &&
                    oldLen > 0 &&
                    full.substring(start, start + oldLen) == lastInsertedText
                if (!canReplace) {
                    Log.d("RETRY", "previous range not found — appending")
                    recycleIfNotCaptured(node)
                    return insertText(newText)
                }
                val rebuilt = full.substring(0, start) + newText + full.substring(start + oldLen)
                val args = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, rebuilt)
                }
                if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                    lastInsertedText = newText
                    setCaret(node, start + newText.length)
                    Log.d("RETRY", "text replaced (start=$start oldLen=$oldLen newLen=${newText.length})")
                    return true
                }
                recycleIfNotCaptured(node)
                insertText(newText)
            } finally {
                recycleIfNotCaptured(node)
            }
        } catch (e: Exception) {
            Log.e("RETRY", "replaceText error", e)
            false
        }
    }

    private fun setCaret(node: AccessibilityNodeInfo, pos: Int) {
        try {
            val sel = Bundle().apply {
                putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, pos)
                putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, pos)
            }
            node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, sel)
        } catch (_: Exception) {}
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

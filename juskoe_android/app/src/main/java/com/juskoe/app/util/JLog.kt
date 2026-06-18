package com.juskoe.app.util

import android.content.Context
import android.util.Log

/**
 * Thin logging wrapper. Verbose/debug logs are gated by the "Debug Mode" setting
 * so release builds stay quiet; warnings and errors always go through.
 */
object JLog {

    @Volatile
    private var verbose = false

    fun init(ctx: Context) {
        verbose = try {
            ctx.getSharedPreferences("juskoe_settings", Context.MODE_PRIVATE)
                .getBoolean("debug_mode", false)
        } catch (_: Exception) {
            false
        }
    }

    fun setVerbose(value: Boolean) { verbose = value }

    fun d(tag: String, msg: String) { if (verbose) Log.d(tag, msg) }
    fun w(tag: String, msg: String) { if (verbose) Log.w(tag, msg) }
    fun e(tag: String, msg: String, t: Throwable? = null) { Log.e(tag, msg, t) }
}

package com.juskoe.app.util

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Global uncaught-exception handler. Persists a stack trace to the app's private
 * storage (so issues are diagnosable from a bug report) and then delegates to the
 * platform default handler so the process still terminates normally.
 */
class CrashHandler private constructor(
    private val appContext: Context,
    private val previous: Thread.UncaughtExceptionHandler?,
) : Thread.UncaughtExceptionHandler {

    override fun uncaughtException(t: Thread, e: Throwable) {
        try {
            val dir = File(appContext.filesDir, "crash").apply { mkdirs() }
            val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            File(dir, "crash_$ts.txt").writeText(
                "Thread: ${t.name}\n\n" + Log.getStackTraceString(e)
            )
            // Keep only the 10 most recent crash logs.
            dir.listFiles()
                ?.sortedByDescending { it.name }
                ?.drop(10)
                ?.forEach { runCatching { it.delete() } }
        } catch (_: Exception) {
            // Never let crash logging itself crash.
        }
        previous?.uncaughtException(t, e)
    }

    companion object {
        fun install(ctx: Context) {
            val prev = Thread.getDefaultUncaughtExceptionHandler()
            Thread.setDefaultUncaughtExceptionHandler(CrashHandler(ctx.applicationContext, prev))
        }
    }
}

package com.juskoe.app.floating

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings

/**
 * Helper for enabling/disabling Float JUSKOE and checking the prerequisite
 * "draw over other apps" (overlay) permission.
 */
object FloatManager {

    private const val PREFS = "juskoe_settings"
    private const val KEY_ENABLED = "float_enabled"

    fun isEnabledPref(ctx: Context): Boolean =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

    private fun setEnabledPref(ctx: Context, value: Boolean) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ENABLED, value).apply()
    }

    fun canDrawOverlay(ctx: Context): Boolean = Settings.canDrawOverlays(ctx)

    /** Intent that opens the system "display over other apps" settings for this app. */
    fun overlayPermissionIntent(ctx: Context): Intent =
        Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${ctx.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /**
     * Try to enable Float JUSKOE. Returns true if started; false if the overlay
     * permission is still required (caller should launch [overlayPermissionIntent]).
     */
    fun enable(ctx: Context): Boolean {
        if (!canDrawOverlay(ctx)) return false
        setEnabledPref(ctx, true)
        FloatingService.start(ctx)
        return true
    }

    fun disable(ctx: Context) {
        setEnabledPref(ctx, false)
        FloatingService.stop(ctx)
    }
}

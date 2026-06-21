package com.juskoe.app.util

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.accessibility.AccessibilityManager
import android.widget.Toast
import com.juskoe.app.floating.FloatingService

/**
 * Centralizes cloud overlay permission checks and service startup.
 * Call [startCloudIfReady] from any Activity/Service to start the overlay if
 * both overlay and accessibility permissions are granted.
 */
object CloudActivationManager {

    private const val TAG = "CloudActivation"

    fun hasOverlayPermission(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true

    fun hasAccessibilityPermission(context: Context): Boolean {
        // PRIMARY: query the system for enabled services and match by PACKAGE.
        // This avoids the applicationId (com.x16studios.juskoe) vs namespace
        // (com.juskoe.app) mismatch that breaks naive class-name string checks.
        try {
            val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
            val enabled = am?.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            if (enabled != null && enabled.any {
                    it.resolveInfo?.serviceInfo?.packageName == context.packageName
                }
            ) {
                Log.d("JUSKOE", "Accessibility: enabled (AccessibilityManager match)")
                return true
            }
        } catch (e: Exception) {
            Log.e(TAG, "AccessibilityManager check failed", e)
        }

        // FALLBACK: parse Settings.Secure, matching package + service simple name
        // (tolerates appId != namespace).
        return try {
            val raw = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            ) ?: return false
            val match = raw.split(':').any { entry ->
                val pkg = entry.substringBefore('/')
                pkg == context.packageName && entry.contains("FloatingAccessibilityService")
            }
            Log.d("JUSKOE", "Accessibility: enabled=$match (Settings.Secure fallback) raw=$raw")
            match
        } catch (e: Exception) {
            Log.e(TAG, "Settings.Secure check failed", e)
            false
        }
    }

    fun requestOverlayPermission(context: Context) {
        if (hasOverlayPermission(context)) return
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun requestAccessibilityPermission(context: Context) {
        if (hasAccessibilityPermission(context)) return
        Toast.makeText(context, "Enable JUSKOE Cloud in Accessibility settings", Toast.LENGTH_LONG).show()
        context.startActivity(
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    /**
     * Start the cloud overlay service if both permissions are granted.
     * Returns true if started, false if a permission is missing.
     */
    fun startCloudIfReady(context: Context): Boolean {
        if (!hasOverlayPermission(context)) {
            Log.d(TAG, "Overlay permission missing")
            return false
        }
        if (!hasAccessibilityPermission(context)) {
            Log.d(TAG, "Accessibility permission missing")
            return false
        }
        Log.d(TAG, "Starting JUSKOE Cloud service")
        FloatingService.start(context)
        return true
    }

    fun stopCloud(context: Context) {
        FloatingService.stop(context)
    }

    /** Open the system "draw over other apps" settings screen for this package. */
    fun openOverlaySettings(context: Context) {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /** Open the system Accessibility settings screen. */
    fun openAccessibilitySettings(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }
}

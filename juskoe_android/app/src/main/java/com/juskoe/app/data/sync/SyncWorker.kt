package com.juskoe.app.data.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.data.local.LocalRepository

/**
 * Background cloud-sync worker for Pro users.
 * Runs the full push/pull reconciliation. Safe to run repeatedly (idempotent
 * thanks to cloudId + natural-key dedup in SyncManager).
 */
class SyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    companion object {
        private const val TAG = "SyncWorker"
    }

    override suspend fun doWork(): Result {
        // Only authenticated users can sync.
        if (!SupabaseManager.isAuthenticated()) {
            Log.d(TAG, "Not authenticated — skipping sync")
            return Result.success()
        }

        // Only Pro users get cloud sync. Use cached plan first (no network), then
        // confirm with the profile when available.
        val cachedPlan = applicationContext
            .getSharedPreferences("juskoe_settings", Context.MODE_PRIVATE)
            .getString("cached_plan", "free") ?: "free"
        val plan = try {
            SupabaseManager.getProfile()?.plan ?: cachedPlan
        } catch (e: Exception) {
            cachedPlan
        }
        if (plan != "pro" && plan != "enterprise") {
            Log.d(TAG, "Not a Pro user — skipping sync")
            return Result.success()
        }

        val repo = LocalRepository.getInstance(applicationContext)
        val ok = SyncManager(repo).syncAll()
        return if (ok) Result.success() else Result.retry()
    }
}

package com.juskoe.app.data.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Schedules cloud sync. Call [requestSyncNow] after a local mutation (add/edit/
 * delete in app or keyboard) and [ensurePeriodicSync] once at app launch.
 */
object SyncScheduler {

    private const val PERIODIC_WORK = "juskoe_periodic_sync"
    private const val ONESHOT_WORK = "juskoe_oneshot_sync"

    private val networkConstraint = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    /** Enqueue an immediate one-off sync (coalesced — keeps the existing one if queued). */
    fun requestSyncNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(networkConstraint)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context.applicationContext)
            .enqueueUniqueWork(ONESHOT_WORK, ExistingWorkPolicy.KEEP, request)
    }

    /** Ensure a periodic (every 6h) background sync exists for Pro users. */
    fun ensurePeriodicSync(context: Context) {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
            .setConstraints(networkConstraint)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context.applicationContext)
            .enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    /** Cancel all sync work (e.g. on sign-out). */
    fun cancelAll(context: Context) {
        WorkManager.getInstance(context.applicationContext).cancelUniqueWork(PERIODIC_WORK)
        WorkManager.getInstance(context.applicationContext).cancelUniqueWork(ONESHOT_WORK)
    }
}

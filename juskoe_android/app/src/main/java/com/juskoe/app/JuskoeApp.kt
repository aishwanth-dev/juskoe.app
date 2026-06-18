package com.juskoe.app

import android.app.Application
import com.juskoe.app.data.local.JuskoeDatabase
import com.juskoe.app.data.local.LocalRepository
import com.juskoe.app.data.sync.SyncScheduler

class JuskoeApp : Application() {

    lateinit var localRepo: LocalRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize Room database + local repository
        JuskoeDatabase.getInstance(this)
        localRepo = LocalRepository.getInstance(this)

        // Cloud sync (Pro users only — the worker self-gates on plan).
        // Periodic background reconciliation + an immediate catch-up on launch.
        SyncScheduler.ensurePeriodicSync(this)
        SyncScheduler.requestSyncNow(this)

        // Restore Float JUSKOE overlay if the user had it enabled and still has
        // the overlay permission.
        try {
            if (com.juskoe.app.floating.FloatManager.isEnabledPref(this) &&
                com.juskoe.app.floating.FloatManager.canDrawOverlay(this)
            ) {
                com.juskoe.app.floating.FloatingService.start(this)
            }
        } catch (_: Exception) {}
    }

    companion object {
        lateinit var instance: JuskoeApp
            private set
    }
}

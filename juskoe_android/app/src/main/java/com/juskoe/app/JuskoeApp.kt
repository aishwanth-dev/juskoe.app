package com.juskoe.app

import android.app.Application
import com.juskoe.app.data.local.JuskoeDatabase
import com.juskoe.app.data.local.LocalRepository
import com.juskoe.app.data.sync.SyncScheduler
import com.juskoe.app.util.CrashHandler
import com.juskoe.app.util.JLog

class JuskoeApp : Application() {

    lateinit var localRepo: LocalRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Production diagnostics first, before anything can crash.
        CrashHandler.install(this)
        JLog.init(this)

        // Initialize Room database + local repository
        JuskoeDatabase.getInstance(this)
        localRepo = LocalRepository.getInstance(this)

        // Cloud sync (Pro users only — the worker self-gates on plan).
        // Periodic background reconciliation + an immediate catch-up on launch.
        SyncScheduler.ensurePeriodicSync(this)
        SyncScheduler.requestSyncNow(this)

        // Auto-start JUSKOE Cloud if permissions are granted.
        try {
            com.juskoe.app.util.CloudActivationManager.startCloudIfReady(this)
        } catch (_: Exception) {}
    }

    companion object {
        lateinit var instance: JuskoeApp
            private set
    }
}

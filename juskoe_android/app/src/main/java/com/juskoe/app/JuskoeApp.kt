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
    }

    companion object {
        lateinit var instance: JuskoeApp
            private set
    }
}

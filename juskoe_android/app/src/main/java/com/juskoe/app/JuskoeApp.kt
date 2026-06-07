package com.juskoe.app

import android.app.Application
import com.juskoe.app.data.local.JuskoeDatabase
import com.juskoe.app.data.local.LocalRepository

class JuskoeApp : Application() {

    lateinit var localRepo: LocalRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize Room database + local repository
        JuskoeDatabase.getInstance(this)
        localRepo = LocalRepository.getInstance(this)
    }

    companion object {
        lateinit var instance: JuskoeApp
            private set
    }
}

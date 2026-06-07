package com.juskoe.app.data.sync

import android.util.Log
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.data.local.*

/**
 * Cloud sync manager for PRO users only.
 * Push local → Supabase, Pull cloud → local.
 */
class SyncManager(private val repo: LocalRepository) {

    companion object {
        private const val TAG = "SyncManager"
    }

    // ============================================
    // Push local → cloud
    // ============================================

    suspend fun pushDictionary() {
        try {
            val items = repo.getAllDictOnce()
            items.filter { it.cloudId == null }.forEach { entry ->
                try {
                    SupabaseManager.upsertDictWord(entry.word, entry.correction)
                    // Mark as synced (we don't get cloud ID back easily, just mark it)
                    repo.updateDict(entry.copy(cloudId = "synced"))
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to push dict: ${entry.word}", e)
                }
            }
            Log.d(TAG, "Dictionary push complete")
        } catch (e: Exception) {
            Log.e(TAG, "pushDictionary failed", e)
        }
    }

    suspend fun pushSnippets() {
        try {
            val items = repo.getAllSnippetsOnce()
            items.filter { it.cloudId == null }.forEach { entry ->
                try {
                    SupabaseManager.upsertSnippet(entry.key, entry.title, entry.content, entry.category)
                    repo.updateSnippet(entry.copy(cloudId = "synced"))
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to push snippet: ${entry.key}", e)
                }
            }
            Log.d(TAG, "Snippets push complete")
        } catch (e: Exception) {
            Log.e(TAG, "pushSnippets failed", e)
        }
    }

    suspend fun pushNotes() {
        try {
            val items = repo.getAllNotesOnce()
            items.filter { it.cloudId == null }.forEach { entry ->
                try {
                    val tags = if (entry.tags.isBlank()) emptyList() else entry.tags.split(",")
                    SupabaseManager.addCloudNote(entry.text, tags)
                    repo.updateNote(entry.copy(cloudId = "synced"))
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to push note: ${entry.id}", e)
                }
            }
            Log.d(TAG, "Notes push complete")
        } catch (e: Exception) {
            Log.e(TAG, "pushNotes failed", e)
        }
    }

    suspend fun pushAll() {
        pushDictionary()
        pushSnippets()
        pushNotes()
    }

    // ============================================
    // Pull cloud → local
    // ============================================

    suspend fun pullDictionary() {
        try {
            val cloudItems = SupabaseManager.getCloudDictionary()
            cloudItems.forEach { cloud ->
                repo.addDict(cloud.word, cloud.correction)
            }
            Log.d(TAG, "Dictionary pull complete: ${cloudItems.size} items")
        } catch (e: Exception) {
            Log.e(TAG, "pullDictionary failed", e)
        }
    }

    suspend fun pullSnippets() {
        try {
            val cloudItems = SupabaseManager.getCloudSnippets()
            cloudItems.forEach { cloud ->
                repo.addSnippet(cloud.key, cloud.title, cloud.content, cloud.category)
            }
            Log.d(TAG, "Snippets pull complete: ${cloudItems.size} items")
        } catch (e: Exception) {
            Log.e(TAG, "pullSnippets failed", e)
        }
    }

    suspend fun pullNotes() {
        try {
            val cloudItems = SupabaseManager.getCloudNotes()
            cloudItems.forEach { cloud ->
                repo.addNote(cloud.text, cloud.tags)
            }
            Log.d(TAG, "Notes pull complete: ${cloudItems.size} items")
        } catch (e: Exception) {
            Log.e(TAG, "pullNotes failed", e)
        }
    }

    suspend fun pullAll() {
        pullDictionary()
        pullSnippets()
        pullNotes()
    }

    // ============================================
    // Full sync (pull then push)
    // ============================================

    suspend fun syncAll() {
        pullAll()
        pushAll()
    }
}

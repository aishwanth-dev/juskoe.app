package com.juskoe.app.data.sync

import android.util.Log
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.data.local.*

/**
 * Cloud sync manager for PRO users.
 *
 * Strategy:
 *  - Push: every local row with cloudId == null is upserted to Supabase; the
 *    REAL returned UUID is stored back as cloudId (no more "synced" placeholder).
 *  - Pull: each cloud row is matched to a local row by cloudId first, then by
 *    natural key (word / key / text). If none exists it is inserted with the
 *    real cloudId; if one exists it is updated (cloud-wins conflict strategy)
 *    and tagged with the cloudId. This prevents the duplicate explosion the
 *    old implementation caused.
 *  - Order: push first (so local-only items reach the cloud), then pull (to
 *    reconcile other devices' changes and backfill cloudIds).
 */
class SyncManager(private val repo: LocalRepository) {

    companion object {
        private const val TAG = "SyncManager"
    }

    // ============================================
    // Push local → cloud (store the real UUID)
    // ============================================

    suspend fun pushDictionary() {
        try {
            repo.getAllDictOnce().filter { it.cloudId == null }.forEach { entry ->
                try {
                    val cloudId = SupabaseManager.upsertDictWord(entry.word, entry.correction)
                    if (cloudId != null) repo.updateDict(entry.copy(cloudId = cloudId))
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to push dict: ${entry.word}", e)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "pushDictionary failed", e)
        }
    }

    suspend fun pushSnippets() {
        try {
            repo.getAllSnippetsOnce().filter { it.cloudId == null }.forEach { entry ->
                try {
                    val cloudId = SupabaseManager.upsertSnippet(entry.key, entry.title, entry.content, entry.category)
                    if (cloudId != null) repo.updateSnippet(entry.copy(cloudId = cloudId))
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to push snippet: ${entry.key}", e)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "pushSnippets failed", e)
        }
    }

    suspend fun pushNotes() {
        try {
            repo.getAllNotesOnce().filter { it.cloudId == null }.forEach { entry ->
                try {
                    val tags = if (entry.tags.isBlank()) emptyList() else entry.tags.split(",")
                    val cloudId = SupabaseManager.addCloudNote(entry.text, tags)
                    if (cloudId != null) repo.updateNote(entry.copy(cloudId = cloudId))
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to push note: ${entry.id}", e)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "pushNotes failed", e)
        }
    }

    suspend fun pushAll() {
        pushDictionary(); pushSnippets(); pushNotes()
    }

    // ============================================
    // Pull cloud → local (dedup + cloud-wins)
    // ============================================

    suspend fun pullDictionary() {
        try {
            val cloudItems = SupabaseManager.getCloudDictionary()
            cloudItems.forEach { cloud ->
                if (cloud.id.isBlank()) return@forEach
                val existing = repo.findDictByCloudId(cloud.id) ?: repo.findDictByWord(cloud.word)
                if (existing == null) {
                    repo.insertDict(DictEntry(word = cloud.word, correction = cloud.correction, cloudId = cloud.id))
                } else if (existing.cloudId != cloud.id || existing.correction != cloud.correction) {
                    repo.updateDict(existing.copy(correction = cloud.correction, cloudId = cloud.id))
                }
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
                if (cloud.id.isBlank()) return@forEach
                val existing = repo.findSnippetByCloudId(cloud.id) ?: repo.findSnippetByKey(cloud.key)
                if (existing == null) {
                    repo.insertSnippet(
                        SnippetEntry(
                            key = cloud.key, title = cloud.title, content = cloud.content,
                            category = cloud.category, cloudId = cloud.id,
                        )
                    )
                } else if (existing.cloudId != cloud.id || existing.content != cloud.content ||
                    existing.title != cloud.title || existing.category != cloud.category
                ) {
                    repo.updateSnippet(
                        existing.copy(
                            title = cloud.title, content = cloud.content,
                            category = cloud.category, cloudId = cloud.id,
                        )
                    )
                }
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
                if (cloud.id.isBlank()) return@forEach
                val existing = repo.findNoteByCloudId(cloud.id) ?: repo.findNoteByText(cloud.text)
                if (existing == null) {
                    repo.insertNote(
                        NoteEntry(text = cloud.text, tags = cloud.tags.joinToString(","), cloudId = cloud.id)
                    )
                } else if (existing.cloudId != cloud.id) {
                    repo.updateNote(existing.copy(cloudId = cloud.id))
                }
            }
            Log.d(TAG, "Notes pull complete: ${cloudItems.size} items")
        } catch (e: Exception) {
            Log.e(TAG, "pullNotes failed", e)
        }
    }

    suspend fun pullAll() {
        pullDictionary(); pullSnippets(); pullNotes()
    }

    // ============================================
    // Full sync — push local-only first, then reconcile from cloud
    // ============================================

    suspend fun syncAll(): Boolean {
        return try {
            pushAll()
            pullAll()
            true
        } catch (e: Exception) {
            Log.e(TAG, "syncAll failed", e)
            false
        }
    }
}

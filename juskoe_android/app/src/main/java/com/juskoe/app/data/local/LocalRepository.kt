package com.juskoe.app.data.local

import android.content.Context
import kotlinx.coroutines.flow.Flow

/**
 * Local-first repository — wraps Room DAOs.
 * All data is saved locally first, cloud sync is a separate layer for pro users.
 */
class LocalRepository private constructor(context: Context) {

    private val db = JuskoeDatabase.getInstance(context)
    private val dictDao = db.dictDao()
    private val snippetDao = db.snippetDao()
    private val noteDao = db.noteDao()
    private val clipDao = db.clipDao()
    private val usageDao = db.usageCacheDao()

    // ============================================
    // Dictionary
    // ============================================

    fun getAllDict(): Flow<List<DictEntry>> = dictDao.getAll()
    suspend fun getAllDictOnce(): List<DictEntry> = dictDao.getAllOnce()
    suspend fun addDict(word: String, correction: String): Long =
        dictDao.insert(DictEntry(word = word, correction = correction))
    suspend fun updateDict(entry: DictEntry) = dictDao.update(entry)
    suspend fun deleteDict(id: Long) = dictDao.deleteById(id)
    fun searchDict(query: String): Flow<List<DictEntry>> = dictDao.search(query)
    // --- sync helpers ---
    suspend fun insertDict(entry: DictEntry): Long = dictDao.insert(entry)
    suspend fun findDictByCloudId(cloudId: String): DictEntry? = dictDao.findByCloudId(cloudId)
    suspend fun findDictByWord(word: String): DictEntry? = dictDao.findByWord(word)

    // ============================================
    // Snippets
    // ============================================

    fun getAllSnippets(): Flow<List<SnippetEntry>> = snippetDao.getAll()
    suspend fun getAllSnippetsOnce(): List<SnippetEntry> = snippetDao.getAllOnce()
    suspend fun addSnippet(key: String, title: String, content: String, category: String = "general"): Long =
        snippetDao.insert(SnippetEntry(key = key, title = title, content = content, category = category))
    suspend fun updateSnippet(entry: SnippetEntry) = snippetDao.update(entry)
    suspend fun deleteSnippet(id: Long) = snippetDao.deleteById(id)
    fun searchSnippets(query: String): Flow<List<SnippetEntry>> = snippetDao.search(query)
    // --- sync helpers ---
    suspend fun insertSnippet(entry: SnippetEntry): Long = snippetDao.insert(entry)
    suspend fun findSnippetByCloudId(cloudId: String): SnippetEntry? = snippetDao.findByCloudId(cloudId)
    suspend fun findSnippetByKey(key: String): SnippetEntry? = snippetDao.findByKey(key)

    // ============================================
    // Notes
    // ============================================

    fun getAllNotes(): Flow<List<NoteEntry>> = noteDao.getAll()
    suspend fun getAllNotesOnce(): List<NoteEntry> = noteDao.getAllOnce()
    suspend fun addNote(text: String, tags: List<String> = emptyList()): Long =
        noteDao.insert(NoteEntry(text = text, tags = tags.joinToString(",")))
    suspend fun updateNote(entry: NoteEntry) = noteDao.update(entry)
    suspend fun deleteNote(id: Long) = noteDao.deleteById(id)
    // --- sync helpers ---
    suspend fun insertNote(entry: NoteEntry): Long = noteDao.insert(entry)
    suspend fun findNoteByCloudId(cloudId: String): NoteEntry? = noteDao.findByCloudId(cloudId)
    suspend fun findNoteByText(text: String): NoteEntry? = noteDao.findByText(text)

    // ============================================
    // Clipboard History
    // ============================================

    fun getClipboard(): Flow<List<ClipEntry>> = clipDao.getAll()
    suspend fun addClip(text: String) {
        clipDao.insert(ClipEntry(text = text))
        clipDao.trimOld()   // keep max 50
    }
    suspend fun clearClipboard() = clipDao.clear()

    // ============================================
    // Usage Cache (offline-first usage tracking)
    // ============================================

    suspend fun getUsage(key: String): Int = usageDao.get(key)?.value ?: 0
    suspend fun setUsage(key: String, value: Int) =
        usageDao.set(UsageCache(key = key, value = value))

    companion object {
        @Volatile
        private var INSTANCE: LocalRepository? = null

        fun getInstance(context: Context): LocalRepository {
            return INSTANCE ?: synchronized(this) {
                LocalRepository(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}

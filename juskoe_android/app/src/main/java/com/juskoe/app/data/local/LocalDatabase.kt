package com.juskoe.app.data.local

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

// ============================================
// Entities
// ============================================

@Entity(tableName = "dictionary")
data class DictEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val word: String,
    val correction: String,
    val createdAt: Long = System.currentTimeMillis(),
    /** null = local only, set after cloud sync */
    val cloudId: String? = null,
)

@Entity(tableName = "snippets")
data class SnippetEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val key: String,
    val title: String,
    val content: String,
    val category: String = "general",
    val createdAt: Long = System.currentTimeMillis(),
    val cloudId: String? = null,
)

@Entity(tableName = "notes")
data class NoteEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val text: String,
    val tags: String = "",          // comma-separated
    val createdAt: Long = System.currentTimeMillis(),
    val cloudId: String? = null,
)

@Entity(tableName = "clipboard_history")
data class ClipEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val text: String,
    val createdAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "usage_cache")
data class UsageCache(
    @PrimaryKey val key: String,     // "daily_ai", "daily_grammar", etc.
    val value: Int = 0,
    val updatedAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "generated_content")
data class GeneratedContentEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val mode: String,           // "ai" or "grammar"
    val input: String,          // transcript / original text
    val output: String,         // processed result
    val createdAt: Long = System.currentTimeMillis(),
)

// ============================================
// DAOs
// ============================================

@Dao
interface DictDao {
    @Query("SELECT * FROM dictionary ORDER BY createdAt DESC")
    fun getAll(): Flow<List<DictEntry>>

    @Query("SELECT * FROM dictionary ORDER BY createdAt DESC")
    suspend fun getAllOnce(): List<DictEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: DictEntry): Long

    /** Insert only if no row with same cloudId exists (prevents refresh duplicates) */
    @Query("INSERT OR IGNORE INTO dictionary (word, correction, cloudId, createdAt) SELECT :word, :correction, :cloudId, :createdAt WHERE NOT EXISTS (SELECT 1 FROM dictionary WHERE cloudId = :cloudId)")
    suspend fun insertIfCloudIdAbsent(word: String, correction: String, cloudId: String, createdAt: Long = System.currentTimeMillis())

    @Update
    suspend fun update(entry: DictEntry)

    @Delete
    suspend fun delete(entry: DictEntry)

    @Query("DELETE FROM dictionary WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("SELECT * FROM dictionary WHERE word LIKE '%' || :query || '%' OR correction LIKE '%' || :query || '%'")
    fun search(query: String): Flow<List<DictEntry>>

    @Query("SELECT * FROM dictionary WHERE cloudId = :cloudId LIMIT 1")
    suspend fun findByCloudId(cloudId: String): DictEntry?

    @Query("SELECT * FROM dictionary WHERE word = :word COLLATE NOCASE LIMIT 1")
    suspend fun findByWord(word: String): DictEntry?
}

@Dao
interface SnippetDao {
    @Query("SELECT * FROM snippets ORDER BY createdAt DESC")
    fun getAll(): Flow<List<SnippetEntry>>

    @Query("SELECT * FROM snippets ORDER BY createdAt DESC")
    suspend fun getAllOnce(): List<SnippetEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: SnippetEntry): Long

    /** Insert only if no row with same cloudId exists */
    @Query("INSERT OR IGNORE INTO snippets (key, title, content, category, cloudId, createdAt) SELECT :key, :title, :content, :category, :cloudId, :createdAt WHERE NOT EXISTS (SELECT 1 FROM snippets WHERE cloudId = :cloudId)")
    suspend fun insertIfCloudIdAbsent(key: String, title: String, content: String, category: String, cloudId: String, createdAt: Long = System.currentTimeMillis())

    @Update
    suspend fun update(entry: SnippetEntry)

    @Delete
    suspend fun delete(entry: SnippetEntry)

    @Query("DELETE FROM snippets WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("SELECT * FROM snippets WHERE key LIKE '%' || :query || '%' OR title LIKE '%' || :query || '%'")
    fun search(query: String): Flow<List<SnippetEntry>>

    @Query("SELECT * FROM snippets WHERE cloudId = :cloudId LIMIT 1")
    suspend fun findByCloudId(cloudId: String): SnippetEntry?

    @Query("SELECT * FROM snippets WHERE key = :key COLLATE NOCASE LIMIT 1")
    suspend fun findByKey(key: String): SnippetEntry?
}

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY createdAt DESC")
    fun getAll(): Flow<List<NoteEntry>>

    @Query("SELECT * FROM notes ORDER BY createdAt DESC")
    suspend fun getAllOnce(): List<NoteEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: NoteEntry): Long

    /** Insert only if no row with same cloudId exists */
    @Query("INSERT OR IGNORE INTO notes (text, tags, cloudId, createdAt) SELECT :text, :tags, :cloudId, :createdAt WHERE NOT EXISTS (SELECT 1 FROM notes WHERE cloudId = :cloudId)")
    suspend fun insertIfCloudIdAbsent(text: String, tags: String, cloudId: String, createdAt: Long = System.currentTimeMillis())

    @Update
    suspend fun update(entry: NoteEntry)

    @Delete
    suspend fun delete(entry: NoteEntry)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("SELECT * FROM notes WHERE cloudId = :cloudId LIMIT 1")
    suspend fun findByCloudId(cloudId: String): NoteEntry?

    @Query("SELECT * FROM notes WHERE text = :text LIMIT 1")
    suspend fun findByText(text: String): NoteEntry?
}

@Dao
interface ClipDao {
    @Query("SELECT * FROM clipboard_history ORDER BY createdAt DESC LIMIT 20")
    fun getAll(): Flow<List<ClipEntry>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: ClipEntry): Long

    @Query("DELETE FROM clipboard_history WHERE id NOT IN (SELECT id FROM clipboard_history ORDER BY createdAt DESC LIMIT 20)")
    suspend fun trimOld()

    @Query("DELETE FROM clipboard_history")
    suspend fun clear()
}

@Dao
interface UsageCacheDao {
    @Query("SELECT * FROM usage_cache WHERE `key` = :key")
    suspend fun get(key: String): UsageCache?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun set(cache: UsageCache)

    /** Delete all keys NOT containing today's date (old daily counters) */
    @Query("DELETE FROM usage_cache WHERE `key` NOT LIKE '%' || :todayDateStr || '%'")
    suspend fun deleteOldKeys(todayDateStr: String)
}

@Dao
interface GeneratedContentDao {
    @Query("SELECT * FROM generated_content ORDER BY createdAt DESC LIMIT 50")
    suspend fun getRecent(): List<GeneratedContentEntry>

    /** Reactive stream for live UI updates (Home history). */
    @Query("SELECT * FROM generated_content ORDER BY createdAt DESC LIMIT 50")
    fun getRecentFlow(): Flow<List<GeneratedContentEntry>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: GeneratedContentEntry): Long

    @Query("DELETE FROM generated_content WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM generated_content")
    suspend fun clearAll()
}

// ============================================
// Database
// ============================================

@Database(
    entities = [DictEntry::class, SnippetEntry::class, NoteEntry::class, ClipEntry::class, UsageCache::class, GeneratedContentEntry::class],
    version = 2,
    exportSchema = false,
)
abstract class JuskoeDatabase : RoomDatabase() {
    abstract fun dictDao(): DictDao
    abstract fun snippetDao(): SnippetDao
    abstract fun noteDao(): NoteDao
    abstract fun clipDao(): ClipDao
    abstract fun usageCacheDao(): UsageCacheDao
    abstract fun generatedContentDao(): GeneratedContentDao

    companion object {
        @Volatile
        private var INSTANCE: JuskoeDatabase? = null

        fun getInstance(context: Context): JuskoeDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    JuskoeDatabase::class.java,
                    "juskoe_db"
                )
                    // Migration safety: never silently wipe data on UPGRADE. Add a
                    // Migration(n, n+1) here whenever the schema/version changes.
                    // Destructive fallback is allowed only on downgrade (dev rollback).
                    .fallbackToDestructiveMigrationOnDowngrade()
                    .build().also { INSTANCE = it }
            }
        }
    }
}

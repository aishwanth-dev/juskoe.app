package com.juskoe.app.ui.screens

import android.content.Context
import android.widget.Toast
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.data.local.JuskoeDatabase
import com.juskoe.app.ui.theme.*
import kotlinx.coroutines.launch
import java.util.UUID


data class DictEntry(
    val id: String = UUID.randomUUID().toString(),
    val shortcut: String,
    val replacement: String,
    val cloudId: String? = null,
)

@Composable
fun DictionaryScreen() {
    var searchQuery by remember { mutableStateOf("") }
    var showDialog by remember { mutableStateOf(false) }
    var editingEntry by remember { mutableStateOf<DictEntry?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var lastRefreshMs by remember { mutableStateOf(0L) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Helper: is cloud sync enabled?
    fun isCloudSyncEnabled(): Boolean {
        val prefs = context.getSharedPreferences("juskoe_settings", Context.MODE_PRIVATE)
        return prefs.getBoolean("cloud_sync", false) && SupabaseManager.isAuthenticated()
    }

    val db = remember { JuskoeDatabase.getInstance(context) }

    // Observe Room directly — keyboard writes & edits reflect instantly (no manual reload)
    val dbEntries by db.dictDao().getAll().collectAsState(initial = emptyList())
    val entries = dbEntries.map {
        DictEntry(
            id = it.id.toString(),
            shortcut = it.word,
            replacement = it.correction,
            cloudId = it.cloudId,
        )
    }

    val filtered = entries.filter {
        searchQuery.isEmpty() ||
                it.shortcut.contains(searchQuery, ignoreCase = true) ||
                it.replacement.contains(searchQuery, ignoreCase = true)
    }

    // Add/Edit Dialog
    if (showDialog) {
        var word by remember { mutableStateOf(editingEntry?.shortcut ?: "") }
        var correction by remember { mutableStateOf(editingEntry?.replacement ?: "") }

        AlertDialog(
            onDismissRequest = { showDialog = false; editingEntry = null },
            title = { Text(if (editingEntry != null) "Edit Entry" else "Add Entry") },
            text = {
                Column {
                    OutlinedTextField(
                        value = word,
                        onValueChange = { word = it },
                        label = { Text("Word / Shortcut") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Brown,
                            unfocusedBorderColor = TextMuted,
                            cursorColor = Brown,
                        ),
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = correction,
                        onValueChange = { correction = it },
                        label = { Text("Correction / Replacement (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Brown,
                            unfocusedBorderColor = TextMuted,
                            cursorColor = Brown,
                        ),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (word.isNotBlank()) {
                            val actualCorrection = correction.ifBlank { word }
                            scope.launch {
                                try {
                                    if (editingEntry != null) {
                                        // Update existing
                                        val localId = editingEntry!!.id.toLongOrNull()
                                        if (localId != null) {
                                            db.dictDao().update(com.juskoe.app.data.local.DictEntry(
                                                id = localId, word = word, correction = actualCorrection, cloudId = editingEntry!!.cloudId
                                            ))
                                        }
                                    } else {
                                        // Insert new
                                        db.dictDao().insert(com.juskoe.app.data.local.DictEntry(
                                            word = word, correction = actualCorrection
                                        ))
                                    }
                                    // Cloud sync if enabled
                                    if (isCloudSyncEnabled()) {
                                        try { SupabaseManager.upsertDictWord(word, actualCorrection) } catch (_: Exception) {}
                                    }
                                } catch (_: Exception) {}
                            }
                            showDialog = false
                            editingEntry = null
                        }
                    },
                ) {
                    Text("Save", color = Brown, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false; editingEntry = null }) {
                    Text("Cancel", color = TextMuted)
                }
            },
        )
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { editingEntry = null; showDialog = true },
                containerColor = Brown,
                contentColor = TextOnBrown,
                shape = CircleShape,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Add Word")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text = "Dictionary",
                        style = MaterialTheme.typography.headlineLarge,
                        color = Brown,
                    )
                    Text(
                        text = "Auto-correct shortcuts during transcription",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = {
                            val now = System.currentTimeMillis()
                            if (now - lastRefreshMs < 10_000) return@IconButton  // 10s cooldown
                            lastRefreshMs = now
                            isLoading = true
                            scope.launch {
                                try {
                                    if (isCloudSyncEnabled()) {
                                        // Pull from cloud → merge into Room (skip existing).
                                        // The Room Flow re-emits automatically after insert.
                                        val cloud = SupabaseManager.getCloudDictionary()
                                        for (c in cloud) {
                                            db.dictDao().insertIfCloudIdAbsent(
                                                word = c.word, correction = c.correction, cloudId = c.id
                                            )
                                        }
                                    }
                                } catch (_: Exception) {}
                                isLoading = false
                            }
                        },
                        modifier = Modifier.size(32.dp),
                    ) {
                        Icon(
                            Icons.Filled.Refresh,
                            contentDescription = "Refresh",
                            tint = Brown,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Tip Box (dismissible, matches desktop)
            val prefs = context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE)
            var showTip by remember { mutableStateOf(!prefs.getBoolean("dict_tip_dismissed", false)) }
            if (showTip) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Brown.copy(alpha = 0.06f)),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Your personal dictionary.",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Brown,
                            )
                            IconButton(
                                onClick = {
                                    showTip = false
                                    prefs.edit().putBoolean("dict_tip_dismissed", true).apply()
                                },
                                modifier = Modifier.size(28.dp),
                            ) {
                                Icon(Icons.Filled.Close, contentDescription = "Close", tint = TextMuted, modifier = Modifier.size(18.dp))
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "Add words Juskoe might mishear — names, technical terms, abbreviations — and tell it exactly what to write instead.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("Aishwanth", "ASAP", "Bengaluru", "iPhone").forEach { pill ->
                                Box(
                                    Modifier
                                        .clip(RoundedCornerShape(20.dp))
                                        .background(Brown.copy(alpha = 0.1f))
                                        .padding(horizontal = 12.dp, vertical = 6.dp),
                                ) {
                                    Text(pill, fontSize = 12.sp, color = Brown, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { editingEntry = null; showDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Brown),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.height(36.dp),
                        ) {
                            Text("Add new word", fontSize = 13.sp)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "${filtered.size} entries",
                style = MaterialTheme.typography.labelMedium,
                color = TextMuted,
            )

            Spacer(modifier = Modifier.height(8.dp))

            if (isLoading) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator(color = Brown, modifier = Modifier.size(32.dp))
                }
            } else if (entries.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "No dictionary entries yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = TextMuted,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Tap + to add word corrections",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextLight,
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(filtered, key = { it.id }) { entry ->
                        DictCard(
                            entry = entry,
                            onEdit = { editingEntry = it; showDialog = true },
                            onDelete = {
                                scope.launch {
                                    try {
                                        val localId = it.id.toLongOrNull()
                                        if (localId != null) db.dictDao().deleteById(localId)
                                        if (it.cloudId != null && isCloudSyncEnabled()) {
                                            SupabaseManager.deleteDictWord(it.cloudId)
                                        }
                                    } catch (_: Exception) {}
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DictCard(
    entry: DictEntry,
    onEdit: (DictEntry) -> Unit,
    onDelete: (DictEntry) -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = BgSecondary),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = entry.shortcut,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = Purple,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = TextLight,
                modifier = Modifier.size(16.dp),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = entry.replacement,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                modifier = Modifier.weight(1f),
            )
            IconButton(
                onClick = { onEdit(entry) },
                modifier = Modifier.size(32.dp),
            ) {
                Icon(Icons.Filled.Edit, null, tint = TextMuted, modifier = Modifier.size(18.dp))
            }
            IconButton(
                onClick = { onDelete(entry) },
                modifier = Modifier.size(32.dp),
            ) {
                Icon(Icons.Filled.Delete, null, tint = Error, modifier = Modifier.size(18.dp))
            }
        }
    }
}

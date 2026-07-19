package com.juskoe.app.ui.screens

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.data.local.JuskoeDatabase
import com.juskoe.app.ui.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

data class NoteItem(
    val id: String = UUID.randomUUID().toString(),
    val content: String,
    val timestamp: String = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date()),
    val cloudId: String? = null,
)

@Composable
fun NotesScreen() {
    var newNoteText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var lastRefreshMs by remember { mutableStateOf(0L) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val db = remember { JuskoeDatabase.getInstance(context) }

    fun isCloudSyncEnabled(): Boolean {
        val prefs = context.getSharedPreferences("juskoe_settings", android.content.Context.MODE_PRIVATE)
        return prefs.getBoolean("cloud_sync", false) && SupabaseManager.isAuthenticated()
    }

    // Observe Room directly — voice notes saved from the keyboard appear instantly
    val dbNotes by db.noteDao().getAll().collectAsState(initial = emptyList())
    val notes = dbNotes.map {
        NoteItem(
            id = it.id.toString(),
            content = it.text,
            timestamp = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(it.createdAt)),
            cloudId = it.cloudId,
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    text = "Notes",
                    style = MaterialTheme.typography.headlineLarge,
                    color = Brown,
                )
                Text(
                    text = "Quick voice notes and reminders",
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
                                        val cloud = SupabaseManager.getCloudNotes()
                                        for (c in cloud) {
                                            db.noteDao().insertIfCloudIdAbsent(
                                                text = c.text, tags = c.tags.joinToString(","), cloudId = c.id
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

        // Compose area
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = newNoteText,
                onValueChange = { newNoteText = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Write a note...") },
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Brown,
                    unfocusedBorderColor = Border,
                    cursorColor = Brown,
                ),
                maxLines = 3,
            )
            Button(
                onClick = {
                    if (newNoteText.isNotBlank()) {
                        val text = newNoteText.trim()
                        newNoteText = ""
                        scope.launch {
                            try {
                                db.noteDao().insert(com.juskoe.app.data.local.NoteEntry(text = text))
                                com.juskoe.app.data.AnalyticsManager.trackNoteCreated()
                                if (isCloudSyncEnabled()) {
                                    try { SupabaseManager.addCloudNote(text) } catch (_: Exception) {}
                                }
                            } catch (_: Exception) {}
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Purple),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.height(56.dp),
                enabled = newNoteText.isNotBlank(),
            ) {
                Icon(Icons.Filled.Add, "Add", modifier = Modifier.size(20.dp))
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "${notes.size} notes",
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
        } else if (notes.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "No notes yet",
                    style = MaterialTheme.typography.bodyLarge,
                    color = TextMuted,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Type a note above to get started",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextLight,
                )
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(notes, key = { it.id }) { note ->
                    NoteCard(
                        note = note,
                        onDelete = {
                            scope.launch {
                                try {
                                    val localId = it.id.toLongOrNull()
                                    if (localId != null) db.noteDao().deleteById(localId)
                                    if (it.cloudId != null && isCloudSyncEnabled()) {
                                        SupabaseManager.deleteCloudNote(it.cloudId)
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

@Composable
private fun NoteCard(
    note: NoteItem,
    onDelete: (NoteItem) -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = BgSecondary),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = note.content,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                maxLines = 5,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = note.timestamp,
                    style = MaterialTheme.typography.labelSmall,
                    color = TextLight,
                )
                IconButton(
                    onClick = { onDelete(note) },
                    modifier = Modifier.size(28.dp),
                ) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "Delete",
                        tint = Error,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

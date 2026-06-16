package com.juskoe.app.ui.screens

import android.content.Context
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.ContentPaste
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.juskoe.app.data.SupabaseManager
import com.juskoe.app.ui.theme.*
import kotlinx.coroutines.launch
import java.util.UUID
import com.juskoe.app.data.local.JuskoeDatabase

data class SnippetEntry(
    val id: String = UUID.randomUUID().toString(),
    val key: String,
    val expansion: String,
    val cloudId: String? = null,
)

@Composable
fun SnippetsScreen() {
    var searchQuery by remember { mutableStateOf("") }
    var showDialog by remember { mutableStateOf(false) }
    var editingSnippet by remember { mutableStateOf<SnippetEntry?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val context = LocalContext.current
    val db = remember { JuskoeDatabase.getInstance(context) }

    fun isCloudSyncEnabled(): Boolean {
        val prefs = context.getSharedPreferences("juskoe_settings", Context.MODE_PRIVATE)
        return prefs.getBoolean("cloud_sync", false) && SupabaseManager.isAuthenticated()
    }

    // Observe Room directly — single source of truth, live updates
    val dbSnippets by db.snippetDao().getAll().collectAsState(initial = emptyList())
    val snippets = dbSnippets.map {
        SnippetEntry(id = it.id.toString(), key = it.key, expansion = it.content, cloudId = it.cloudId)
    }

    val filtered = snippets.filter {
        searchQuery.isEmpty() ||
                it.key.contains(searchQuery, ignoreCase = true) ||
                it.expansion.contains(searchQuery, ignoreCase = true)
    }

    // Add/Edit Dialog
    if (showDialog) {
        var key by remember { mutableStateOf(editingSnippet?.key ?: "") }
        var content by remember { mutableStateOf(editingSnippet?.expansion ?: "") }

        AlertDialog(
            onDismissRequest = { showDialog = false; editingSnippet = null },
            title = { Text(if (editingSnippet != null) "Edit Snippet" else "Add Snippet") },
            text = {
                Column {
                    OutlinedTextField(
                        value = key,
                        onValueChange = { key = it },
                        label = { Text("Trigger key (e.g. sig)") },
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
                        value = content,
                        onValueChange = { content = it },
                        label = { Text("Expansion text") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        maxLines = 4,
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
                        if (key.isNotBlank() && content.isNotBlank()) {
                            scope.launch {
                                try {
                                    if (editingSnippet != null) {
                                        val localId = editingSnippet!!.id.toLongOrNull()
                                        if (localId != null) {
                                            db.snippetDao().update(com.juskoe.app.data.local.SnippetEntry(
                                                id = localId, key = key, title = key, content = content, cloudId = editingSnippet!!.cloudId
                                            ))
                                        }
                                    } else {
                                        db.snippetDao().insert(com.juskoe.app.data.local.SnippetEntry(
                                            key = key, title = key, content = content
                                        ))
                                    }
                                    if (isCloudSyncEnabled()) {
                                        try { SupabaseManager.upsertSnippet(key, key, content) } catch (_: Exception) {}
                                    }
                                } catch (_: Exception) {}
                            }
                            showDialog = false
                            editingSnippet = null
                        }
                    },
                ) {
                    Text("Save", color = Brown, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false; editingSnippet = null }) {
                    Text("Cancel", color = TextMuted)
                }
            },
        )
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { editingSnippet = null; showDialog = true },
                containerColor = Brown,
                contentColor = TextOnBrown,
                shape = CircleShape,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Add Snippet")
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
                        text = "Snippets",
                        style = MaterialTheme.typography.headlineLarge,
                        color = Brown,
                    )
                    Text(
                        text = "Quick text expansions for common phrases",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = {
                            isLoading = true
                            scope.launch {
                                try {
                                    if (isCloudSyncEnabled()) {
                                        val cloud = SupabaseManager.getCloudSnippets()
                                        for (c in cloud) {
                                            // Use dedup insert (fixes duplicate-on-refresh bug)
                                            db.snippetDao().insertIfCloudIdAbsent(
                                                key = c.key, title = c.title, content = c.content, category = c.category, cloudId = c.id
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
                    if (SupabaseManager.isAuthenticated()) {
                        Icon(
                            Icons.Filled.CloudSync,
                            contentDescription = "Synced",
                            tint = Success,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Tip Box (dismissible, matches desktop)
            val context = LocalContext.current
            val prefs = context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE)
            var showTip by remember { mutableStateOf(!prefs.getBoolean("snippets_tip_dismissed", false)) }
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
                                "Say it once, use it everywhere.",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Brown,
                            )
                            IconButton(
                                onClick = {
                                    showTip = false
                                    prefs.edit().putBoolean("snippets_tip_dismissed", true).apply()
                                },
                                modifier = Modifier.size(28.dp),
                            ) {
                                Icon(Icons.Filled.Close, contentDescription = "Close", tint = TextMuted, modifier = Modifier.size(18.dp))
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "Save text you use all the time \u2014 emails, links, addresses, intros \u2014 and let Juskoe paste them instantly when you speak the trigger word.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        // Example rows
                        listOf(
                            "my github" to "https://github.com/your-username",
                            "my email" to "yourname@example.com",
                        ).forEach { (key, value) ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    Modifier.clip(RoundedCornerShape(8.dp))
                                        .background(Brown.copy(alpha = 0.12f))
                                        .padding(horizontal = 10.dp, vertical = 4.dp),
                                ) {
                                    Text(key, fontSize = 12.sp, color = Brown, fontWeight = FontWeight.SemiBold)
                                }
                                Text("  \u2192  ", fontSize = 12.sp, color = TextMuted)
                                Text(value, fontSize = 12.sp, color = TextMuted)
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { editingSnippet = null; showDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Brown),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.height(36.dp),
                        ) {
                            Text("Add new snippet", fontSize = 13.sp)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search snippets...") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Brown,
                    unfocusedBorderColor = Border,
                    cursorColor = Brown,
                ),
                singleLine = true,
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "${filtered.size} snippets",
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
            } else if (snippets.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "No snippets yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = TextMuted,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Tap + to create text expansions",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextLight,
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(filtered, key = { it.id }) { snippet ->
                        SnippetCard(
                            snippet = snippet,
                            onEdit = { editingSnippet = it; showDialog = true },
                            onDelete = {
                                scope.launch {
                                    try {
                                        val localId = it.id.toLongOrNull()
                                        if (localId != null) db.snippetDao().deleteById(localId)
                                        if (it.cloudId != null && isCloudSyncEnabled()) {
                                            SupabaseManager.deleteSnippet(it.cloudId)
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
private fun SnippetCard(
    snippet: SnippetEntry,
    onEdit: (SnippetEntry) -> Unit,
    onDelete: (SnippetEntry) -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = BgSecondary),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.ContentPaste,
                        contentDescription = null,
                        tint = Amber,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = snippet.key,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Amber,
                    )
                }
                Row {
                    IconButton(
                        onClick = { onEdit(snippet) },
                        modifier = Modifier.size(32.dp),
                    ) {
                        Icon(Icons.Filled.Edit, null, tint = TextMuted, modifier = Modifier.size(18.dp))
                    }
                    IconButton(
                        onClick = { onDelete(snippet) },
                        modifier = Modifier.size(32.dp),
                    ) {
                        Icon(Icons.Filled.Delete, null, tint = Error, modifier = Modifier.size(18.dp))
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = snippet.expansion,
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

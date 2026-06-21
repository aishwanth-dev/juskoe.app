package com.juskoe.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.juskoe.app.floating.FloatingAccessibilityService
import com.juskoe.app.floating.FloatingService
import com.juskoe.app.util.CloudActivationManager
import kotlinx.coroutines.delay

/**
 * Live diagnostics for the JUSKOE Cloud overlay. Shows permission + service
 * state (auto-refreshing) and exposes force actions so failures are obvious.
 */
class CloudDiagnosticsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    CloudDiagnosticsScreen()
                }
            }
        }
    }
}

@Composable
private fun CloudDiagnosticsScreen() {
    val context = LocalContext.current
    var overlay by remember { mutableStateOf(false) }
    var accessibility by remember { mutableStateOf(false) }
    var floatingRunning by remember { mutableStateOf(false) }
    var accRunning by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (true) {
            overlay = CloudActivationManager.hasOverlayPermission(context)
            accessibility = CloudActivationManager.hasAccessibilityPermission(context)
            floatingRunning = FloatingService.instance != null
            accRunning = FloatingAccessibilityService.instance != null
            delay(1500)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("JUSKOE CLOUD DIAGNOSTICS", fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))

        DiagnosticRow("Overlay Permission", overlay)
        DiagnosticRow("Accessibility Permission", accessibility)
        DiagnosticRow("FloatingService Running", floatingRunning)
        DiagnosticRow("AccessibilityService Running", accRunning)
        DiagnosticRow("Cloud Active", floatingRunning)

        Spacer(Modifier.height(8.dp))
        HorizontalDivider()
        Spacer(Modifier.height(8.dp))

        Text("If any status shows ✗:", fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Text("• Overlay: Settings → Apps → JUSKOE → Draw over other apps", fontSize = 13.sp)
        Text("• Accessibility: Settings → Accessibility → JUSKOE Cloud → ON", fontSize = 13.sp)
        Text("• Service not running: tap 'Force Start Cloud' below", fontSize = 13.sp)
        Spacer(Modifier.height(8.dp))
        Text("Logcat: adb logcat -s JUSKOE:D", fontSize = 13.sp, color = Color.Gray)
        Spacer(Modifier.height(16.dp))

        Button(
            onClick = { CloudActivationManager.startCloudIfReady(context) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Force Start Cloud") }
        Spacer(Modifier.height(8.dp))

        Button(
            onClick = { FloatingService.instance?.showCloud() },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
        ) { Text("Force Show Cloud") }
        Spacer(Modifier.height(8.dp))

        Button(
            onClick = { FloatingService.instance?.hideCloud() },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF44336)),
        ) { Text("Hide Cloud") }
        Spacer(Modifier.height(8.dp))

        Button(
            onClick = { CloudActivationManager.openOverlaySettings(context) },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2196F3)),
        ) { Text("Open Overlay Settings") }
        Spacer(Modifier.height(8.dp))

        Button(
            onClick = { CloudActivationManager.openAccessibilitySettings(context) },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2196F3)),
        ) { Text("Open Accessibility Settings") }
    }
}

@Composable
private fun DiagnosticRow(label: String, value: Boolean) {
    Row(modifier = Modifier.padding(vertical = 4.dp)) {
        Text("$label: ", fontSize = 14.sp)
        Text(
            text = if (value) "✓" else "✗",
            color = if (value) Color(0xFF4CAF50) else Color(0xFFF44336),
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
        )
    }
}

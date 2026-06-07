package com.juskoe.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

// Dark theme for the keyboard view
private val KeyboardColorScheme = darkColorScheme(
    primary = Brown,
    onPrimary = TextOnBrown,
    secondary = Purple,
    onSecondary = White,
    tertiary = Amber,
    onTertiary = White,
    background = Brown,
    onBackground = TextOnBrown,
    surface = BrownLight,
    onSurface = TextOnBrown,
    surfaceVariant = BrownBorder,
    onSurfaceVariant = TextLight,
    outline = BrownBorder,
    error = Error,
    onError = White,
)

@Composable
fun JuskoeKeyboardTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = KeyboardColorScheme,
        typography = JuskoeTypography,
        content = content,
    )
}

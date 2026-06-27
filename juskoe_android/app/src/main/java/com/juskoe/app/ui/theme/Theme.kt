package com.juskoe.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Light: white canvas, near-black text, purple accent.
private val JuskoeColorScheme = lightColorScheme(
    primary = Purple,
    onPrimary = White,
    primaryContainer = PurpleSurface,
    onPrimaryContainer = PurpleDark,
    secondary = Purple,
    onSecondary = White,
    secondaryContainer = PurpleSurface,
    onSecondaryContainer = PurpleDark,
    tertiary = PurpleLight,
    onTertiary = White,
    tertiaryContainer = PurpleSurface,
    onTertiaryContainer = PurpleDark,
    background = White,
    onBackground = TextPrimary,
    surface = White,
    onSurface = TextPrimary,
    surfaceVariant = BgSecondary,
    onSurfaceVariant = TextMuted,
    outline = Border,
    outlineVariant = BorderLight,
    error = Error,
    onError = White,
)

// Dark: Raycast/Nothing-style near-black canvas with a brighter purple accent.
private val JuskoeDarkColorScheme = darkColorScheme(
    primary = PurpleDarkMode,
    onPrimary = White,
    primaryContainer = DarkSurfaceVariant,
    onPrimaryContainer = PurpleLight,
    secondary = PurpleDarkMode,
    onSecondary = White,
    secondaryContainer = DarkSurfaceVariant,
    onSecondaryContainer = PurpleLight,
    tertiary = PurpleLight,
    onTertiary = White,
    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkCard,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkTextSecondary,
    outline = BrownBorder,
    outlineVariant = DarkSurfaceVariant,
    error = Error,
    onError = White,
)

@Composable
fun JuskoeTheme(darkTheme: Boolean = false, content: @Composable () -> Unit) {
    val colorScheme = if (darkTheme) JuskoeDarkColorScheme else JuskoeColorScheme
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            (view.context as? Activity)?.window?.let { window ->
                // Premium edge-to-edge: white (light) / near-black (dark) system bars
                // with content-aware icon coloring.
                val barColor = if (darkTheme) DarkBackground else White
                window.statusBarColor = barColor.toArgb()
                window.navigationBarColor = barColor.toArgb()
                val insets = WindowCompat.getInsetsController(window, view)
                insets.isAppearanceLightStatusBars = !darkTheme
                insets.isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = JuskoeTypography,
        content = content
    )
}

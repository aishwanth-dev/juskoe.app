package com.juskoe.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val JuskoeColorScheme = lightColorScheme(
    primary = Brown,
    onPrimary = TextOnBrown,
    primaryContainer = BrownLight,
    onPrimaryContainer = TextOnBrown,
    secondary = Purple,
    onSecondary = White,
    secondaryContainer = PurpleLight,
    onSecondaryContainer = PurpleDark,
    tertiary = Amber,
    onTertiary = White,
    tertiaryContainer = AmberLight,
    onTertiaryContainer = Amber,
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

private val DarkBg = Color(0xFF121212)
private val DarkSurface = Color(0xFF1E1E1E)
private val DarkSurfaceVariant = Color(0xFF2A2A2A)
private val DarkOnSurface = Color(0xFFEDEDED)

private val JuskoeDarkColorScheme = darkColorScheme(
    primary = Brown,
    onPrimary = White,
    primaryContainer = BrownLight,
    onPrimaryContainer = White,
    secondary = Purple,
    onSecondary = White,
    tertiary = Amber,
    onTertiary = White,
    background = DarkBg,
    onBackground = DarkOnSurface,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = TextMuted,
    outline = Border,
    outlineVariant = BorderLight,
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
                window.statusBarColor = if (darkTheme) DarkBg.toArgb() else Brown.toArgb()
                window.navigationBarColor = if (darkTheme) DarkBg.toArgb() else White.toArgb()
                val insets = WindowCompat.getInsetsController(window, view)
                insets.isAppearanceLightStatusBars = false
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

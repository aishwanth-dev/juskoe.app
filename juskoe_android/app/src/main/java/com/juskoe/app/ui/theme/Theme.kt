package com.juskoe.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
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

@Composable
fun JuskoeTheme(content: @Composable () -> Unit) {
    val colorScheme = JuskoeColorScheme
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            (view.context as? Activity)?.window?.let { window ->
                window.statusBarColor = Brown.toArgb()
                window.navigationBarColor = White.toArgb()
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
                WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = true
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = JuskoeTypography,
        content = content
    )
}

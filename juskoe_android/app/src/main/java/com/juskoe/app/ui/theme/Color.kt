package com.juskoe.app.ui.theme

import androidx.compose.ui.graphics.Color

// ============================================
// JUSKOE Design Language — Black + White + Purple
// Premium AI identity (Apple Intelligence / Linear / Arc / Nothing OS)
// Purple is the signature ACCENT (~5% of the UI). Everything else is neutral.
// ============================================

// ── Neutrals (the "Brown" names are kept for compatibility; now premium black) ──
val Brown = Color(0xFF111111)        // near-black — hero cards, primary text emphasis
val BrownDark = Color(0xFF000000)    // pure black
val BrownLight = Color(0xFF1F1F1F)
val BrownBorder = Color(0xFF2A2A2A)

// ── Backgrounds ──
val White = Color(0xFFFFFFFF)        // primary background
val BgSecondary = Color(0xFFF7F7F8)  // secondary background
val BgHover = Color(0xFFF3F4F6)
val BgSidebar = Color(0xFFF7F7F8)
val CardBg = Color(0xFFFCFCFD)       // card background

// ── Text ──
val TextPrimary = Color(0xFF111111)
val TextMuted = Color(0xFF6B7280)
val TextLight = Color(0xFF9CA3AF)
val TextOnBrown = Color(0xFFFFFFFF)

// ── Accent — Purple (signature). The legacy "Amber" names now map to purple
//    tints so the active/recording/grammar states read as on-brand purple. ──
val Amber = Color(0xFFA78BFA)        // light purple — grammar / secondary mode accent
val AmberLight = Color(0xFFF3F0FF)
val AmberWarning = Color(0xFFA855F7)

// ── Status ──
val Success = Color(0xFF22C55E)
val Error = Color(0xFFEF4444)
val ErrorDark = Color(0xFFE74C3C)

// ── Borders ──
val Border = Color(0xFFE5E7EB)
val BorderLight = Color(0xFFF0F0F0)
val SidebarBorder = Color(0xFFE5E7EB)

// ── Purple (signature accent) ──
val Purple = Color(0xFF7C3AED)         // primary purple — CTAs, AI mode, focus
val PurpleDark = Color(0xFF6D28D9)     // pressed / dark purple
val PurpleLight = Color(0xFFA78BFA)    // light purple
val PurpleSurface = Color(0xFFF3F0FF)  // soft purple surface (pills, AI cards, selected chips)
val PurpleGradientEnd = Color(0xFFA855F7) // gradient end (#7C3AED → #A855F7)

// ── Dark mode (Raycast + Nothing OS + Apple) ──
val DarkBackground = Color(0xFF0B0B0F)
val DarkCard = Color(0xFF17171C)
val DarkSurfaceVariant = Color(0xFF1F1F26)
val DarkTextPrimary = Color(0xFFFFFFFF)
val DarkTextSecondary = Color(0xFFA1A1AA)
val PurpleDarkMode = Color(0xFF8B5CF6)  // purple accent in dark mode

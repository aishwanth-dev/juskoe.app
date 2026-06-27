package com.juskoe.app.ui.navigation

import android.content.Context
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.NoteAlt
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material.icons.outlined.ContentCut
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.NoteAlt
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.juskoe.app.data.UsageSummary
import com.juskoe.app.ui.screens.*
import com.juskoe.app.ui.theme.Purple
import com.juskoe.app.ui.theme.PurpleSurface
import com.juskoe.app.ui.theme.TextMuted
import androidx.compose.material3.MaterialTheme
import com.juskoe.app.viewmodel.AuthUiState

data class BottomNavItem(
    val route: String,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
)

val bottomNavItems = listOf(
    BottomNavItem("home", "Home", Icons.Filled.Home, Icons.Outlined.Home),
    BottomNavItem("notes", "Notes", Icons.Filled.NoteAlt, Icons.Outlined.NoteAlt),
    BottomNavItem("dictionary", "Dict", Icons.Filled.Book, Icons.Outlined.Book),
    BottomNavItem("snippets", "Snippets", Icons.Filled.ContentCut, Icons.Outlined.ContentCut),
    BottomNavItem("settings", "Settings", Icons.Filled.Settings, Icons.Outlined.Settings),
)

@Composable
fun JuskoeNavHost(
    authState: AuthUiState,
    usageState: UsageSummary,
    onGoogleSignIn: () -> Unit,
    onSignUp: (String, String, String?) -> Unit,
    onSignIn: (String, String) -> Unit,
    onSignOut: () -> Unit,
    onRefreshUsage: () -> Unit,
) {
    val context = LocalContext.current
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Determine if onboarding has been completed
    val prefs = remember { context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE) }
    val onboardingDone = remember { prefs.getBoolean("onboarding_done", false) }

    // Determine start destination
    val startDestination = if (onboardingDone) "home" else "onboarding"

    // Routes that should NOT show the bottom bar
    val noBottomBarRoutes = setOf("onboarding", "auth")
    val showBottomBar = currentDestination?.route !in noBottomBarRoutes

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = Purple,
                ) {
                    bottomNavItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                Icon(
                                    imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.label,
                                    tint = if (selected) Purple else TextMuted,
                                )
                            },
                            label = {
                                Text(
                                    item.label,
                                    color = if (selected) Purple else TextMuted,
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Purple,
                                selectedTextColor = Purple,
                                unselectedIconColor = TextMuted,
                                unselectedTextColor = TextMuted,
                                indicatorColor = PurpleSurface,
                            ),
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(innerPadding),
            enterTransition = { fadeIn() },
            exitTransition = { fadeOut() },
        ) {
            composable("onboarding") {
                OnboardingScreen(
                    onComplete = {
                        navController.navigate("home") {
                            popUpTo("onboarding") { inclusive = true }
                        }
                    },
                )
            }
            composable("home") {
                HomeScreen(
                    authState = authState,
                    usageState = usageState,
                    onNavigateToAuth = {
                        navController.navigate("auth") {
                            launchSingleTop = true
                        }
                    },
                    onRefreshUsage = onRefreshUsage,
                )
            }
            composable("notes") { NotesScreen() }
            composable("dictionary") { DictionaryScreen() }
            composable("snippets") { SnippetsScreen() }
            composable("settings") {
                SettingsScreen(
                    profile = authState.profile,
                    usage = usageState,
                    onSignOut = onSignOut,
                    onNavigateToAuth = {
                        navController.navigate("auth") {
                            launchSingleTop = true
                        }
                    },
                )
            }
            composable("auth") {
                AuthScreen(
                    authState = authState,
                    onGoogleSignIn = onGoogleSignIn,
                    onSignUp = onSignUp,
                    onSignIn = onSignIn,
                    onSkip = {
                        navController.navigate("home") {
                            popUpTo("auth") { inclusive = true }
                        }
                    },
                )
            }
        }
    }
}

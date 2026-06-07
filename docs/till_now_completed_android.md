# JUSKOE Android — Completed Work (Till Now)

## Summary

The Android app is functional at a "beta" level. The core architecture is in place — custom keyboard with voice pipeline, local Room database, cloud sync skeleton, authentication with Google + Email, and all 5 main screens. However, many features are incomplete or buggy.

---

## Architecture (Completed)

### App Foundation ✅
- `JuskoeApp.kt` — Application class with Room DB + LocalRepository initialization
- Singleton pattern for database and repository
- Room Database v2 with 6 entities: dictionary, snippets, notes, clipboard_history, usage_cache, generated_content
- DAOs with Flow-based reactive queries + suspend one-shot queries
- `LocalRepository` wrapper for all DAOs (local-first design)

### Authentication ✅ (Partially Working)
- `AuthViewModel` with StateFlow-based state management
- Supabase session status listener (auto-refreshes on auth state changes)
- Google Native Sign-In via ComposeAuth (`rememberSignInWithGoogle`)
- Email + Password sign-up and sign-in
- Sign-out functionality
- OAuth deep-link handling (scheme: `com.x16studios.juskoe://callback`)
- Auto-redirect on successful login
- Session persistence between app launches
- Plan caching in SharedPreferences (survives network failures)

### Custom Keyboard (IME) ✅ (Core Working)
- `JuskoeKeyboardService` — Full InputMethodService implementation
- Lifecycle plumbing: LifecycleOwner, ViewModelStoreOwner, SavedStateRegistryOwner (all 3 required for ComposeView in IME)
- ViewTree owners set on decorView (critical for Compose rendering)
- ComposeView-based keyboard UI rendering
- State management via `mutableStateOf(KeyboardState())`
- Service coroutine scope with SupervisorJob

### Keyboard UI ✅ (Fully Implemented)
- Samsung-style dark theme keyboard layout
- Full QWERTY with number row always visible
- 3-state shift: OFF → ON (one letter) → CAPS LOCK → OFF
- Symbol pages (2 pages with page switching)
- Context-aware action key (Search/Send/Go/Done/Enter based on IME editor info)
- Mode strip: AI (swipe right) | Grammar (swipe left) | Notes (tap)
- Drag-to-activate with animated arrows and threshold detection
- Tool row: emoji, settings, keyboard toggle, language picker, clipboard
- Suggestion bar with 3 autocomplete suggestions from 800+ common words
- Clipboard tray (shows recent clips)
- Emoji grid with categories and tab navigation
- BigEqualizer animation (mic pulse → recording bars → processing dots → done branding)
- Key press animations (scale + color change)
- Progressive backspace (hold-to-repeat with 3 phases: slow 100ms, medium 75ms, fast 60ms)
- JuskoeBranding composable with serif/sans-serif italic styling

### Keyboard Functionality ✅
- Text input via InputConnection.commitText()
- Backspace with selected text handling
- Progressive word-deletion on hold
- Double-tap space → ". " (period + space)
- Auto-capitalize at sentence start, after newline, at text start
- Key click sounds via AudioManager
- Clipboard paste from tray

### Voice Pipeline ✅ (Core Working)
- `VoicePipeline.kt` — Full processing chain
- `AudioRecorder.kt` — PCM 16kHz mono recording via AudioRecord API
- `SherpaSTT.kt` — On-device Whisper Tiny Multilingual via Sherpa-ONNX
- `GeminiService.kt` — REST API calls to Gemini 2.5 Flash Lite
- Hallucination filtering (blocks "thank you", "thanks for watching", etc.)
- Silence trimming on PCM data before STT
- 30-second max audio cap
- Lazy STT initialization (doesn't block service startup)
- STT pre-warming on service create
- Language change detection and re-initialization

### AI Processing ✅
- AI Mode system prompt (mirrors desktop aiProcessor.ts exactly)
- Grammar Mode system prompt (fix-only, no rewrites)
- Snippet context injection into system prompts
- Dictionary context injection into system prompts
- Multilingual support (preserves user's language mix)
- Max 1000 tokens output, temperature 0.3
- Ktor HTTP client with JSON serialization

### Transcript Pre-Processing ✅
- Dictionary corrections applied to raw transcript (word-boundary regex)
- Snippet trigger replacement ("my name", "add my email", etc.)
- Both applied before sending to Gemini
- Post-processing corrections also applied to Gemini output (in keyboard service)

### Credit System ✅
- Pre-recording credit check (blocks recording if over limit)
- Local usage cache in Room (daily counters with date-based keys)
- Remote usage increment via Supabase RPC
- Plan-aware limits (free: 10 AI + 15 Grammar/day, pro: unlimited)
- Daily reset via old key cleanup
- Cached plan in SharedPreferences (keyboard reads this without network)
- Fail-open on network errors (never blocks user if check fails)

### Navigation ✅
- Jetpack Navigation Compose with NavHost
- 7 routes: onboarding, home, notes, dictionary, snippets, settings, auth
- Bottom navigation bar (5 items: Home, Notes, Dict, Snippets, Settings)
- Routes without bottom bar: onboarding, auth
- Save/restore state on tab switching
- Onboarding completion tracked via SharedPreferences

### Screens Completed ✅

#### AuthScreen
- Google native sign-in button with NativeSignInResult handling
- Email/Password form with validation (min 6 chars)
- Sign-up / Sign-in toggle
- Error display (Toast + Card)
- "Continue offline" skip button
- Auto-redirect on successful auth

#### OnboardingScreen
- First-time setup slides
- Marks `onboarding_done` in SharedPreferences

#### HomeScreen
- Time-based greeting ("Good morning/afternoon/evening, Name")
- Keyboard enable status check
- Credits display (AI + Grammar usage bars)
- Quick Guide (dismissible)
- Recent history from Room DB (GeneratedContentEntry list)
- History cards with copy, delete, detail dialog
- Plan upgrade banner
- Sign-in prompt for unauthenticated users

#### DictionaryScreen
- Full CRUD (Add, Edit, Delete)
- Room DB persistence
- Cloud sync on add/edit/delete (if enabled)
- Refresh button (pulls from cloud → merges into Room)
- Search filtering
- Tip box (dismissible)
- Loading state with spinner
- 10-second cooldown on refresh

#### SnippetsScreen
- Full CRUD (Add, Edit, Delete)
- Room DB persistence
- Cloud sync on add/edit/delete (if enabled)
- Refresh button with cloud pull
- Search filtering
- Tip box with example snippets
- Sync status indicator (cloud icon)

#### NotesScreen
- Add notes via text input
- Room DB persistence
- Cloud sync on add/delete
- Refresh with cloud pull + merge (uses insertIfCloudIdAbsent)
- Delete with cloud delete
- Timestamp display

#### SettingsScreen (3 tabs)
- **General Tab**:
  - Enable/Set Default keyboard links
  - Mic toggle
  - Cloud Sync toggle (Pro only, triggers full push on enable)
  - Auto-capitalize, Autocorrect, Key Sound toggles
  - STT Language picker (70+ languages, multi-select)
- **System Tab**:
  - Dark Mode toggle
  - Haptic Feedback toggle
  - Debug Mode toggle
  - Version display
  - Reset Onboarding
- **Account Tab**:
  - Profile card (avatar initial, name, email, plan)
  - Usage bars (AI, Grammar, Monthly with progress indicators)
  - Sign Out button
  - Not-signed-in prompt

### Cloud Sync ✅ (Skeleton Working)
- `SyncManager.kt` — Push/Pull logic for dict, snippets, notes
- Push: filters local items where cloudId == null → upserts to Supabase
- Pull: fetches all cloud items → inserts into Room
- syncAll: pull then push
- Used in Settings (cloud sync toggle) and individual screens (refresh buttons)

### Supabase Integration ✅
- `SupabaseManager` singleton with client configuration
- Auth: Google, Email sign-in/up, sign-out, session checking
- Postgrest: CRUD on cloud_dictionary, cloud_snippets, cloud_notes
- RPC: get_usage_summary, increment_usage
- ComposeAuth with googleNativeLogin
- PKCE flow type
- Realtime plugin installed (but not actively used)

### Config ✅
- All constants centralized in `Config.kt`
- Free/Pro plan limits
- API keys (obfuscated)
- Audio parameters (16kHz, mono, 16-bit)
- App version

### Theme ✅
- `JuskoeTheme` — Material 3 with custom colors
- `JuskoeKeyboardTheme` — Separate theme for keyboard (dark)
- Color palette: Brown, Purple, Amber, Success, Error, Muted, etc.
- Light theme for app, dark theme for keyboard

### Build Configuration ✅
- `build.gradle.kts` with all dependencies
- Sherpa-ONNX AAR as local library
- Supabase Kotlin SDK (auth, postgrest, realtime, compose-auth)
- Ktor client for Gemini API calls
- Jetpack Compose BOM
- Room with KSP annotation processor
- Min SDK 26, Target SDK 34

---

## Data Flow Diagram (Completed)

```
User speaks → AudioRecorder (PCM 16kHz)
    ↓
SherpaSTT.transcribe(pcmData) → raw transcript
    ↓
preprocessTranscript(raw, snippets, dict) → cleaned transcript
    ↓
GeminiService.processVoiceInput(transcript, mode, snippets, dict) → AI output
    ↓
applyDictAndSnippets(output) → final text
    ↓
InputConnection.commitText(finalText) + clipboard copy + Room save
    ↓
Usage increment (local + cloud)
```

---

## What's Working End-to-End

1. ✅ Install app → enable keyboard → switch to JUSKOE
2. ✅ Open keyboard → see QWERTY layout → type text
3. ✅ Swipe/tap AI mode → record → get AI-processed output pasted
4. ✅ Swipe/tap Grammar mode → record → get grammar-fixed output pasted
5. ✅ Notes mode → record → transcript saved as note
6. ✅ Sign in with Google → profile shown → usage tracked
7. ✅ Sign in with Email → same
8. ✅ Add/edit/delete dictionary entries → persisted in Room
9. ✅ Add/edit/delete snippets → persisted in Room
10. ✅ Add/delete notes → persisted in Room
11. ✅ Credits displayed on home + keyboard mode strip
12. ✅ Recent history shows on home page
13. ✅ Settings persist across app restarts (SharedPreferences)
14. ✅ STT language selection persisted and applied

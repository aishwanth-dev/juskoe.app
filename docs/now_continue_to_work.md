# JUSKOE Android — Everything To Fix, Implement, and Ship to Production

## Table of Contents
1. [Critical Bugs to Fix](#1-critical-bugs-to-fix)
2. [Keyboard Performance & Functionality Fixes](#2-keyboard-performance--functionality-fixes)
3. [Sync System Overhaul](#3-sync-system-overhaul)
4. [Google Login Fix](#4-google-login-fix)
5. [New Feature: Float JUSKOE](#5-new-feature-float-juskoe)
6. [App Screen Fixes & Polish](#6-app-screen-fixes--polish)
7. [Production Readiness](#7-production-readiness)
8. [Workspace Organization Plan](#8-workspace-organization-plan)

---

## 1. Critical Bugs to Fix

### 1.1 Google Login Not Working Properly
**Problem**: Google Native Sign-In via ComposeAuth is unreliable. Sometimes the flow completes but session status doesn't fire, leaving user in limbo.

**Root Causes**:
- `onGoogleSignIn` in MainActivity just calls `authViewModel.refreshAfterLogin()` which adds a 500ms delay hoping session propagates — fragile
- The session status collector can silently fail if Supabase client initialization is slow
- No retry logic if the session check fails after Google sign-in
- Deep link handler may not process the callback if activity was destroyed

**Fixes Needed**:
- [ ] Make `onGoogleSignIn` actually wait for session to be authenticated (poll sessionStatus with timeout)
- [ ] Add a fallback: if 3 seconds after Google sign-in completes and no Authenticated status fires, manually call `client.auth.retrieveUser()` to get the session
- [ ] Handle the case where ComposeAuth's NativeSignInResult.Success fires but Supabase session isn't ready
- [ ] Add a loading spinner on the AuthScreen during the post-Google-sign-in wait
- [ ] Persist auth tokens in EncryptedSharedPreferences so session survives app kills
- [ ] Once logged in, NEVER show auth screen again on app launch (currently relies on session being active)

### 1.2 Cloud Sync Not Working
**Problem**: Even with cloud sync toggle ON, data doesn't sync properly between devices or even between app restart on same device.

**Root Causes**:
- SyncManager only pushes items where `cloudId == null`, but after push it sets cloudId to literal string "synced" — not the actual Supabase UUID
- On pull, it just inserts everything without checking for duplicates properly (DictionaryScreen uses `insertIfCloudIdAbsent` but cloudId is "synced" not the real ID)
- No automatic sync trigger — user has to manually press refresh on each screen
- No conflict resolution (last-write-wins isn't implemented)
- SnippetsScreen refresh uses `insert` (with OnConflictStrategy.REPLACE) which creates duplicates with new IDs
- Notes have no deduplication at all on pull

**Fixes Needed**:
- [ ] Store actual cloud UUID as cloudId after push (need to get the returned ID from Supabase upsert)
- [ ] Implement proper deduplication: before inserting cloud items, check by unique key (word for dict, key for snippets, text+timestamp for notes)
- [ ] Add automatic background sync on app launch (if authenticated + cloud sync enabled)
- [ ] Add automatic sync on data mutation (add/edit/delete should push immediately)
- [ ] Implement last-modified timestamp comparison for conflict resolution
- [ ] Fix SnippetsScreen refresh to use `insertIfCloudIdAbsent` like DictionaryScreen does
- [ ] Add sync status indicator per item (synced/pending/failed)
- [ ] Add WorkManager periodic sync (every 15 min for Pro users)

### 1.3 Local Sync Not Working
**Problem**: Data added via keyboard (notes mode, clipboard history) doesn't appear in the app screens until manual refresh.

**Root Causes**:
- Screens load data once in `LaunchedEffect(Unit)` — never re-queries
- Keyboard service writes to Room DB directly but app screens use snapshot lists (mutableStateListOf) that aren't connected to Room's Flow
- No shared ViewModel or event bus between keyboard service and app

**Fixes Needed**:
- [ ] Convert all screens to observe Room's Flow (collectAsState) instead of loading once
- [ ] Or: add a timestamp-based invalidation — screen checks last-modified on resume
- [ ] Use SharedPreferences or a local broadcast to notify app when keyboard writes data
- [ ] Consider using `collectAsState(initial)` pattern with Room Flow for live updates

---

## 2. Keyboard Performance & Functionality Fixes

### 2.1 Keyboard Lag/Freeze Issues
**Problem**: Keyboard is laggy, freezes during use, and has noticeable input delay.

**Root Causes**:
- `mutableStateOf(KeyboardState())` triggers full recomposition of the entire keyboard on ANY state change (voice state, shift, suggestions, credits — all in one object)
- `updateSuggestions()` runs on every keypress (splits text, scans 800+ word list, updates state → recomposition)
- STT initialization happens on service create (can block UI if model loading is slow)
- `refreshCredits()` makes network calls on every voice use completion → blocks UI if slow
- `animateFloatAsState` on every key creates many animation objects
- Large COMMON_WORDS list scanned linearly on every keystroke

**Fixes Needed**:
- [ ] Split KeyboardState into multiple separate states:
  - `typingState` (shift, capsLock, numericMode, currentWord, suggestions)
  - `voiceState` (activeMode, voiceState, errorMessage)
  - `creditState` (aiCredits, aiCreditsTotal, grammarCredits, grammarCreditsTotal)
  - `uiState` (isQwertyExpanded, showClipboard, clipboardHistory, imeAction)
- [ ] Debounce `updateSuggestions()` — delay 100ms after last keystroke before computing
- [ ] Replace linear COMMON_WORDS scan with a Trie data structure for O(prefix-length) lookup
- [ ] Move all network calls to Dispatchers.IO and never update state from network on Main
- [ ] Use `derivedStateOf` for computed values instead of storing in state
- [ ] Ensure STT init never runs on Main thread (currently uses `serviceScope` which is Main + SupervisorJob)
- [ ] Add `remember` with keys for animation values to prevent recreation
- [ ] Profile with Android Studio profiler and fix specific frame drops

### 2.2 Keyboard Functionality Gaps
**Problem**: Missing standard keyboard features that users expect.

**Missing Features**:
- [ ] Long-press key for alternate characters (e.g., long-press 'e' → é, è, ê, ë)
- [ ] Swipe-to-type (gesture typing)
- [ ] Number pad view (dedicated numeric keyboard for phone/pin fields)
- [ ] Haptic feedback on keypress (setting exists but not wired)
- [ ] Key sound setting not read by keyboard service (setting exists in SharedPreferences but keyboard doesn't check it)
- [ ] Cursor movement (no way to move cursor left/right precisely)
- [ ] Select all / cut / copy / paste toolbar
- [ ] Undo last voice input
- [ ] IME_FLAG_NO_FULLSCREEN handling (some apps request specific keyboard behavior)
- [ ] Autocorrect integration (setting exists but no actual autocorrect logic)
- [ ] Prediction bar with next-word prediction (not just prefix completion)

### 2.3 Voice Mode UX Issues
- [ ] No visual feedback showing recording duration
- [ ] No way to re-record if result is bad (one-shot only)
- [ ] Error messages disappear too fast (3s) or overlap with content
- [ ] "Done" button flow is confusing — sometimes starts recording, sometimes stops
- [ ] No cancel-during-processing option (must wait for full pipeline)
- [ ] No preview of result before pasting (user can't review before commit)

---

## 3. Sync System Overhaul

### 3.1 Design a Proper Sync Architecture

```
┌─────────────────────────────────────────────────────┐
│                SYNC ARCHITECTURE                     │
│                                                     │
│  LOCAL (Room)           CLOUD (Supabase)            │
│  ┌───────────┐          ┌───────────────┐          │
│  │ dict      │ ←──────→ │cloud_dictionary│          │
│  │ snippets  │ ←──────→ │cloud_snippets │          │
│  │ notes     │ ←──────→ │cloud_notes    │          │
│  └───────────┘          └───────────────┘          │
│       ↕                        ↕                    │
│  SyncQueue (new table)   Supabase Realtime          │
│  - pending operations    - listen for changes       │
│  - retry on failure      - push notifications       │
└─────────────────────────────────────────────────────┘
```

**Implementation Plan**:
- [ ] Add `updatedAt` timestamp to all local entities
- [ ] Add `syncStatus` enum to all entities: SYNCED, PENDING_PUSH, PENDING_DELETE, CONFLICT
- [ ] Add `cloudId` (actual UUID from Supabase) — stop using "synced" string
- [ ] Create SyncQueue Room table: (id, entityType, entityId, operation, createdAt, retryCount)
- [ ] SyncWorker (WorkManager): processes queue every 15 min or on network restore
- [ ] Immediate sync: on mutation, add to queue + attempt immediate push
- [ ] Pull strategy: on app launch + every 15 min, fetch cloud items modified since last pull
- [ ] Conflict resolution: cloud wins if both modified (simple strategy to start)
- [ ] Supabase Realtime subscription for push notifications (optional, Pro only)

### 3.2 Sync Between Keyboard and App
- [ ] Both keyboard and app use the same Room database (already do)
- [ ] App screens must observe Room Flows for live updates
- [ ] When keyboard writes generated content, app's HomeScreen shows it immediately
- [ ] When user adds dict entry in app, keyboard's applyDictAndSnippets picks it up next use (already works since it queries Room each time)

---

## 4. Google Login Fix

### 4.1 Complete Fix Plan

**Current Problem Flow**:
```
User taps "Continue with Google"
  → ComposeAuth starts Native Google flow
  → Google picker shows, user selects account
  → NativeSignInResult.Success fires
  → onGoogleSignIn() calls refreshAfterLogin()
  → refreshAfterLogin() waits 500ms then calls refreshState()
  → BUT: Supabase session may not be ready yet
  → Result: Sometimes works, sometimes shows "Failed to load profile"
```

**Fixed Flow**:
```
User taps "Continue with Google"
  → ComposeAuth starts Native Google flow
  → Google picker shows, user selects account
  → NativeSignInResult.Success fires
  → Session status collector fires Authenticated (automatic!)
  → refreshState() loads profile + usage
  → AuthUiState updates → UI redirects to home
  → NO manual refresh needed
```

**Tasks**:
- [ ] Remove `refreshAfterLogin()` delay hack
- [ ] Trust the session status collector — it fires Authenticated automatically when ComposeAuth completes
- [ ] Add timeout + retry: if Authenticated doesn't fire within 5s after NativeSignInResult.Success, manually call `client.auth.retrieveUser()` and refresh
- [ ] Fix `onGoogleSignIn` to be a no-op or just log (session flow handles everything)
- [ ] Add error recovery: if profile load fails after auth, retry 3 times with exponential backoff
- [ ] Ensure deep link callback (OAuth fallback flow) also triggers refresh properly
- [ ] Test edge cases: slow network, app killed during OAuth, rotation during sign-in

### 4.2 "Once Logged In, Never Ask Again"
- [ ] After successful login, store a flag: `SharedPreferences("is_logged_in", true)`
- [ ] On app launch, if `is_logged_in == true`, skip auth screen and go to home even if session check is still loading
- [ ] If session check eventually fails (token expired), THEN redirect to auth
- [ ] On sign-out, clear the flag

---

## 5. New Feature: Float JUSKOE (Floating Overlay)

### 5.1 Concept

Instead of requiring users to switch to JUSKOE keyboard, provide a floating icon that works with ANY keyboard:

```
┌────────────────────────────────┐
│  [Any app with text field]     │
│                                │
│  ┌─────────┐                   │
│  │ Default │              [J]  │ ← Floating JUSKOE icon
│  │Keyboard │                   │    (right edge, middle)
│  │         │                   │
│  └─────────┘                   │
└────────────────────────────────┘

User taps [J]:
┌────────────────────────────────┐
│                                │
│                          [AI]  │
│                          [G ]  │ ← Expands to 3 buttons
│                          [N ]  │
│                                │
└────────────────────────────────┘

User taps [AI]:
┌────────────────────────────────┐
│                                │
│                     ┌───────┐  │
│                     │ 🎤    │  │ ← Listening animation
│                     │Speak..│  │    (same as keyboard)
│                     └───────┘  │
│                                │
└────────────────────────────────┘

After processing: text pasted at cursor + copied to clipboard
```

### 5.2 Technical Implementation

**Requires**:
- `SYSTEM_ALERT_WINDOW` permission (draw over other apps)
- Foreground Service with `TYPE_APPLICATION_OVERLAY` window
- AccessibilityService (to paste text into focused field when not using our keyboard)

**Architecture**:
```kotlin
// New files needed:
com.juskoe.app.floating/
├── FloatingService.kt           // Foreground service managing overlay
├── FloatingView.kt              // Compose-in-overlay (or custom View)
├── FloatingState.kt             // State: collapsed/expanded/recording/processing
└── FloatingAccessibility.kt     // AccessibilityService for text injection
```

**Tasks**:
- [ ] Add `SYSTEM_ALERT_WINDOW` permission to AndroidManifest
- [ ] Create `FloatingService` (Foreground Service with notification)
- [ ] Create overlay window with `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY`
- [ ] Implement collapsed state: single JUSKOE icon (draggable, right-edge anchored)
- [ ] Implement expanded state: vertical stack [AI] [G] [N] buttons
- [ ] On button tap: start recording with same VoicePipeline
- [ ] Show listening animation inline (replace buttons with animation)
- [ ] On result: paste via AccessibilityService + copy to clipboard
- [ ] Settings toggle: "Enable Float JUSKOE" (enable/disable service)
- [ ] Auto-show when ANY keyboard opens (detect IME visibility via WindowInsets or ViewTreeObserver)
- [ ] Auto-hide when keyboard closes
- [ ] Edge-snap behavior (always snaps to right edge)
- [ ] Draggable vertically along right edge
- [ ] Add to SettingsScreen General tab as a toggle

### 5.3 Accessibility Service for Text Injection
- [ ] Register AccessibilityService in AndroidManifest
- [ ] Use `AccessibilityNodeInfo.ACTION_SET_TEXT` or `ACTION_PASTE` to inject text
- [ ] Fallback: copy to clipboard + show toast "Copied! Long-press to paste"

---

## 6. App Screen Fixes & Polish

### 6.1 Home Screen
- [ ] Live-update history when returning from keyboard use (observe Room Flow)
- [ ] Sort history by most recent (already done by query but verify)
- [ ] Add pull-to-refresh on history
- [ ] Show sync status (last synced time)
- [ ] Fix: credits don't refresh when navigating back to home tab
- [ ] Add: daily streak counter
- [ ] Add: total words generated stat

### 6.2 Dictionary Screen
- [ ] Live-update when keyboard applies corrections (observe Flow)
- [ ] Add search bar (currently filtering exists but no search input field shown)
- [ ] Show cloud sync status per entry (icon: ✓ synced, ↑ pending)
- [ ] Auto-sync on add/edit/delete (don't wait for manual refresh)
- [ ] Fix duplicate entries on cloud pull (use insertIfCloudIdAbsent properly with real cloud IDs)
- [ ] Add import/export (CSV)

### 6.3 Snippets Screen
- [ ] Same sync fixes as Dictionary
- [ ] Fix: refresh creates duplicates (uses `insert` instead of `insertIfCloudIdAbsent`)
- [ ] Add category support in UI (currently stored but not displayed/filterable)
- [ ] Add snippet preview expansion (tap to see full content)

### 6.4 Notes Screen
- [ ] Add tags UI (currently stored as comma-separated string but not shown)
- [ ] Add search/filter by text
- [ ] Add edit capability (currently can only add and delete)
- [ ] Fix: no deduplication on cloud pull
- [ ] Show cloud sync icon when note is synced

### 6.5 Settings Screen
- [ ] Wire up "Dark Mode" toggle to actually change app theme (currently just saves preference but doesn't apply)
- [ ] Wire up "Haptic Feedback" toggle to keyboard (keyboard doesn't read this setting)
- [ ] Wire up "Key Sound" toggle to keyboard service (currently plays sound always regardless of setting)
- [ ] Wire up "Auto-capitalize" and "Autocorrect" toggles (keyboard has auto-cap but doesn't check the setting toggle)
- [ ] Add "Float JUSKOE" toggle (new feature)
- [ ] Add "About" section with links (privacy policy, terms, support)
- [ ] Add "Rate App" button
- [ ] Add "Share App" button
- [ ] Fix: Cloud Sync push doesn't properly wait/report completion (just fires and forgets)

---

## 7. Production Readiness

### 7.1 Performance
- [ ] Profile app with Android Studio Profiler — fix jank
- [ ] Baseline Profile generation (Jetpack Macrobenchmark)
- [ ] R8/ProGuard optimization for release builds
- [ ] Reduce APK size (current model files are 100+ MB)
  - Consider downloading models on first launch instead of bundling
  - Or use Android App Bundle (AAB) with asset delivery
- [ ] Memory leak detection (LeakCanary in debug)
- [ ] Startup time optimization (tracing with `Trace.beginSection`)

### 7.2 Error Handling & Resilience
- [ ] Global crash handler (catch unhandled exceptions, log to file or crashlytics)
- [ ] Network connectivity monitoring (show offline banner)
- [ ] Graceful degradation: if Gemini fails → show transcript as-is with "AI unavailable" message
- [ ] Retry logic on all network calls (3 retries with exponential backoff)
- [ ] Timeout on Gemini calls (currently no timeout — can hang forever)
- [ ] Handle STT model corruption (re-download if transcription consistently fails)

### 7.3 Security
- [ ] Move API keys to BuildConfig (don't hardcode in Config.kt)
- [ ] Use Supabase Edge Functions to proxy Gemini calls (don't expose Gemini key in client)
- [ ] Add certificate pinning for Supabase and Gemini API
- [ ] Use EncryptedSharedPreferences for tokens and sensitive data
- [ ] ProGuard/R8 obfuscation for release builds
- [ ] Remove `WRITE_EXTERNAL_STORAGE` permission (not needed for API 26+)

### 7.4 Testing
- [ ] Unit tests for VoicePipeline (mock STT + Gemini)
- [ ] Unit tests for SyncManager
- [ ] Unit tests for credit calculation logic
- [ ] UI tests for AuthScreen flow
- [ ] Integration test: full pipeline (record → STT → Gemini → output)
- [ ] Keyboard service instrumented test

### 7.5 Analytics & Monitoring
- [ ] Add Firebase Analytics (or similar) for screen views, feature usage
- [ ] Add Firebase Crashlytics for crash reporting
- [ ] Track: keyboard activation rate, voice mode usage, error rates
- [ ] Add performance monitoring (pipeline latency, STT time, Gemini time)

### 7.6 App Store Readiness
- [ ] App signing with upload key
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Screenshots for Play Store listing
- [ ] Feature graphic
- [ ] App description and changelogs
- [ ] Content rating questionnaire
- [ ] Review Google's keyboard/IME policy compliance
- [ ] Review Accessibility Service policy compliance (if implementing Float JUSKOE)
- [ ] Data safety section (declare what data is collected)

### 7.7 UX Polish
- [ ] Loading skeletons instead of spinners
- [ ] Smooth page transitions (shared element transitions)
- [ ] Empty state illustrations
- [ ] Onboarding redesign (show keyboard setup steps with screenshots)
- [ ] First-use tutorial overlay for keyboard voice modes
- [ ] Proper error messages (not just "something's off")
- [ ] Success feedback (checkmark animation, haptic)
- [ ] Edge-to-edge display (handle system bars properly)

---

## 8. Workspace Organization Plan

### Current State (Messy):
```
juskoe/
├── src/                    ← Desktop Electron (mixed with root)
├── juskoe_android/         ← Android app
├── website/                ← Website (has its own .git!)
├── assets/                 ← Desktop assets (models, binaries)
├── build/, dist/, release/ ← Desktop build outputs
├── New folder/             ← Random images (junk)
├── .tmp_sql_body.json      ← Temp file
├── juskoe-debug.log        ← Debug logs
├── juskoe-stderr.txt       ← Stderr dump
├── juskoe-stdout.txt       ← Stdout dump
├── package.json            ← Desktop deps (at root!)
├── supabase_schema.sql     ← Database schema
└── lots of scattered files
```

### Proposed Clean Structure:
```
juskoe/
├── README.md                          ← Project overview
├── LICENSE
├── .gitignore
│
├── desktop/                           ← Desktop Electron app (was at root)
│   ├── src/
│   │   ├── main/                      ← Electron main process
│   │   ├── renderer/                  ← React UI
│   │   └── shared/                    ← Shared types
│   ├── assets/                        ← Models, logo (moved from root/assets)
│   ├── build/                         ← Build resources
│   ├── package.json                   ← Desktop dependencies
│   ├── tsconfig.json
│   ├── tsconfig.main.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
│
├── android/                           ← Android app (renamed from juskoe_android)
│   ├── app/
│   ├── gradle/
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   └── gradlew
│
├── website/                           ← Website (keep as-is, remove nested .git)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── supabase/                          ← Backend (already exists)
│   ├── schema.sql                     ← Move supabase_schema.sql here
│   ├── migrations/
│   └── config.toml
│
├── docs/                              ← Documentation
│   ├── about_juskoe.md
│   ├── till_now_completed_android.md
│   ├── now_continue_to_work.md
│   └── integrating-openrouter.md      ← Move existing doc here
│
├── shared/                            ← Shared constants/types (future)
│   └── plan-limits.json               ← Single source of truth for limits
│
└── .github/                           ← CI/CD (future)
    └── workflows/
```

### Organization Tasks:
- [ ] Create `desktop/` folder and move: src/, build/, dist/, release/, package.json, tsconfig*.json, vite.config.ts, .env.example
- [ ] Move `assets/` into `desktop/assets/` (models are desktop-specific)
- [ ] Rename `juskoe_android/` → `android/`
- [ ] Remove `New folder/` (random images, not needed)
- [ ] Remove temp files: `.tmp_sql_body.json`, `juskoe-debug.log`, `juskoe-stderr.txt`, `juskoe-stdout.txt`
- [ ] Move `supabase_schema.sql` → `supabase/schema.sql`
- [ ] Move `Integrating OpenRouter API Into Juskoe.md` → `docs/`
- [ ] Move `new_changes.txt` → `docs/` or delete
- [ ] Remove `website/.git/` (use single root git)
- [ ] Remove Android build log files (`juskoe_android/build_*.txt`)
- [ ] Create proper root `.gitignore` covering all 3 projects
- [ ] Create root `README.md` with project overview and setup instructions
- [ ] Update all relative paths in configs after move

---

## Priority Order (Recommended Execution)

### Phase 1: Fix Critical Bugs (Do First)
1. Google Login fix
2. "Never ask again" persistent session
3. Local sync (screens observe Room Flows)
4. Keyboard performance (split state, debounce suggestions)

### Phase 2: Sync System
5. Fix cloudId handling (store real UUIDs)
6. Fix deduplication on pull
7. Auto-sync on data mutation
8. Background sync with WorkManager

### Phase 3: Keyboard Polish
9. Wire settings toggles to keyboard
10. Long-press alternate characters
11. Haptic feedback
12. Cursor movement keys

### Phase 4: Float JUSKOE
13. Floating Service + overlay
14. Recording from floating icon
15. Text injection via AccessibilityService
16. Settings toggle

### Phase 5: Production Polish
17. Error handling + retry logic
18. Security (move keys to BuildConfig/Edge Functions)
19. Analytics + crash reporting
20. Performance profiling + optimization

### Phase 6: Ship
21. Workspace reorganization
22. Git push to GitHub
23. Play Store submission prep
24. Beta testing

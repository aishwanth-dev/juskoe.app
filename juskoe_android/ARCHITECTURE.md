# JUSKOE Cloud — Architecture

> Cloud-first AI communication layer. JUSKOE is **not** an AI keyboard — it is a
> floating intelligence layer that works on top of any keyboard, in every app.

## Primary Modules (Cloud-First — active development)

| File | Role | Status |
|---|---|---|
| `floating/FloatingService.kt` | Overlay window manager (foreground service, draggable bubble, AI/Grammar/Notes routing, text delivery) | **Exists** — to evolve into Cloud UX |
| `floating/FloatingAccessibilityService.kt` | Focused-field detection + direct text insertion via `ACTION_SET_TEXT` | **Exists** — to extend with caret/bounds positioning |
| `floating/FloatManager.kt` | Overlay-permission gate, enable/disable, pref persistence | Exists |
| `data/VoicePipeline.kt` | Audio capture, on-device STT (Sherpa), preprocess, Gemini call; `transcribeForNote()` | Exists |
| `data/GeminiService.kt` | AI calls via Supabase `ai-proxy` Edge Function (key off-device), timeout + retry | Exists |
| `data/AnalyticsManager.kt` | Fire-and-forget events → Supabase `logs` table | Exists |
| `data/SupabaseManager.kt` | Supabase client (auth, postgrest, RPC) | Exists |
| `data/local/` (Room) | `JuskoeDatabase` + DAOs: dictionary, snippets, notes, clipboard, usage, generated_content | Exists |
| `data/sync/` | `SyncManager`, `SyncWorker`, `SyncScheduler` (Pro cloud sync) | Exists |
| `ui/` | `MainActivity`, Home/Notes/Dictionary/Snippets/Settings/Auth/Onboarding screens (Compose) | Exists |
| `viewmodel/AuthViewModel.kt` | Auth state via `StateFlow<AuthUiState>` (session-status driven) | Exists |
| `util/` | `CrashHandler`, `JLog` | Exists |

## Legacy Modules (Deprecated — do not expand)

| File | Note |
|---|---|
| `keyboard/JuskoeKeyboardService.kt` | InputMethodService. Kept for backward compat. Critical fixes only. |
| `keyboard/KeyboardView.kt` | Legacy Compose keyboard UI. No new features. |

## Resources

| Resource | Status |
|---|---|
| `res/drawable/juskoe_logo.png` | Present (used as current overlay logo) |
| `res/drawable/ic_google.xml` | Present |
| `res/drawable/ic_cloud.xml` | **MISSING** — required by v5.0 Cloud spec |
| `res/values/strings.xml` | Present (app_name, keyboard_name, accessibility_desc, …) |
| `res/xml/accessibility_service_config.xml` | Present (typeViewFocused, canRetrieveWindowContent) |
| Sherpa AAR `app/libs/sherpa-onnx-1.12.25.aar` | Present locally (gitignored) |
| Whisper models `assets/sherpa-onnx-whisper-tiny/*.onnx` + tokens | Present locally (gitignored) |

## Data / Security
- AI key (`KJUS`) lives only in the `ai-proxy` Edge Function env — never in the APK.
- Client config (Supabase URL, anon key, OAuth client IDs, Edge URL) injected via `BuildConfig` from gitignored `local.properties`.
- Analytics write to the existing `logs` table (RLS-scoped to `auth.uid()`).

## Cloud UX Target (per reference diagram — to be implemented)
- States: IDLE (breathing) → LISTENING (voice bars) → PROCESSING (spin) → SUCCESS (green glow) / ERROR (red shake + retry).
- Single tap = AI mode; double tap = Grammar; long-press = full menu (AI, Grammar, Offline, Rewrite, Professional, Friendly, Shorter, Longer, Translate, Snippets, Settings, Exit).
- Positioning priority: exact caret → estimated caret → top-right of active field → safe on-screen fallback. Never off-screen, never covering send buttons.
- Direct insertion only (no clipboard for AI output).

## Build / Verification Constraint (IMPORTANT)
The current development host has **no Android SDK / JDK / Gradle**, so `./gradlew assembleDebug`
cannot be executed here and no APK can be produced or verified in this environment.
All build/APK verification gates must run on a machine with the Android toolchain.

# JUSKOE Cloud — Current State Audit

Branch: `feature/android-production` · HEAD after this pass: `5842029`
Baseline restored: build-verified `60ddc68` (the accidental cloud-demolition was parked via `git stash`, recoverable).

## File status

| File | Purpose | Status |
|---|---|---|
| `floating/JuskoeCloudView.kt` | 56dp cloud view, state machine, animations | ✅ present (229 lines) |
| `floating/VoiceBarsView.kt` | amplitude-reactive bars | ✅ present |
| `floating/FloatingService.kt` | overlay window, voice workflow, transforms, 12-item menu, direct insertion, retry | ✅ present (full) |
| `floating/FloatingAccessibilityService.kt` | caret tracking + direct text insertion | ✅ present |
| `util/CloudActivationManager.kt` | permission checks + service start; now also openOverlay/AccessibilitySettings | ✅ present (extended) |
| `data/AnalyticsManager.kt` | fire-and-forget logs (7 events) | ✅ present |
| `data/GeminiService.kt` | AI via ai-proxy edge function (gemini-2.5-flash) | ✅ present |
| `data/VoicePipeline.kt` | record/STT/pipeline (`processRecording`, `transcribeForNote`) | ✅ present |
| `data/AudioRecorder.kt` | PCM record + `amplitudeListener` | ✅ present |
| `ui/MainActivity.kt` | entry; auto-starts cloud on launch/sign-in/onResume | ✅ cloud-first |
| `ui/screens/HomeScreen.kt` | cloud activation card + diagnostics/debug buttons | ✅ updated |
| `ui/CloudDiagnosticsActivity.kt` | live state + force actions | ✅ created this pass |
| `viewmodel/AuthViewModel.kt` | auth state + `authEvent` SignedIn | ✅ present |
| `keyboard/JuskoeKeyboardService.kt` | legacy IME | ✅ LEGACY (untouched) |
| `res/drawable/juskoe_logo.png` | cloud logo | ✅ present |
| `res/xml/accessibility_service_config.xml` | a11y config | ✅ present |
| Sherpa AAR + tiny int8 ONNX models | on-device STT | ✅ placed locally (gitignored) |

## Wiring verified by code inspection (not a rewrite)
- Single-tap → AI listening; double-tap → Grammar; long-press → 12-item menu; retry icon → re-run last audio.
- `runMode`: AI/Grammar via `VoicePipeline.processRecording` → `GeminiService.processVoiceInput` (ai-proxy); Notes/Offline via on-device `transcribeForNote`.
- `deliver()` inserts via `FloatingAccessibilityService.insertText` (ACTION_SET_TEXT). No clipboard in the primary path.
- Caret-aware top-right positioning with on-screen clamping + below-caret fallback.
- Amplitude streamed via `recorder.amplitudeListener` → `cloudView.setAmplitude`.

## Added this pass
- `CloudDiagnosticsActivity` (+ manifest entry) with live permission/service state and force Start/Show/Hide + open-settings buttons.
- `CloudActivationManager.openOverlaySettings` / `openAccessibilitySettings`.
- Home screen: "Cloud Diagnostics" button + debug-only "Start Cloud (Test)" button.
- JUSKOE-tagged logs on create/position/listen/insert/caret paths.

## Hard constraint
This workstation has **no JDK/Android SDK/Gradle** — `./gradlew assembleDebug` cannot run here. The "BUILD VERIFIED" commits were produced in a separate build-capable environment, which must compile/verify these additions and run the on-device checklist.

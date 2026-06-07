# About JUSKOE — Full Deep Detailed Overview

## What is JUSKOE?

JUSKOE is a voice-powered productivity platform that turns spoken words into polished, ready-to-use text. It works as:
- **Desktop App** (Windows/Mac) — Electron-based, triggered via global hotkeys
- **Android App** — Standalone app + custom keyboard (IME)
- **Website** — Landing page / marketing (React + Vite, deployed on Vercel)

The core idea: you speak into a microphone, JUSKOE transcribes it, processes it with AI (grammar correction, full AI rewriting, or note-taking), and pastes the result wherever your cursor is. No typing required.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                        JUSKOE CLOUD                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Supabase (PostgreSQL + Auth)             │  │
│  │  • Auth (Google OAuth, Email/Password)               │  │
│  │  • profiles, subscriptions, usage_logs               │  │
│  │  • cloud_dictionary, cloud_snippets, cloud_notes     │  │
│  │  • RPC: get_usage_summary, increment_usage           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Gemini API (gemini-2.5-flash-lite)          │  │
│  │  • AI Mode: Full content generation                  │  │
│  │  • Grammar Mode: Fix spelling/grammar only           │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Desktop (Win)  │  │ Android App+KB  │  │    Website       │
│  Electron + TS  │  │ Kotlin + Compose│  │ React + Vite     │
│  sherpa-onnx    │  │ sherpa-onnx AAR │  │ Vercel deployed  │
│  (node binding) │  │ (Android AAR)   │  │                  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## How JUSKOE Works (Voice Pipeline)

### Step-by-Step Pipeline (identical on Desktop and Android):

1. **Trigger** — User activates via hotkey (desktop) or swipe/tap (Android keyboard)
2. **Credit Check** — Pre-recording check: is the user within free plan limits? Pro users bypass.
3. **Record Audio** — PCM 16-bit, 16kHz mono. Desktop uses native mic via ffmpeg. Android uses AudioRecord API.
4. **STT (On-Device)** — Speech-to-Text via Sherpa-ONNX:
   - Desktop: Whisper Base (English) — `ggml-base.en.bin` (~142 MB)
   - Android: Whisper Tiny Multilingual (INT8) — `tiny-encoder.int8.onnx` + `tiny-decoder.int8.onnx` (~103 MB combined)
   - Supports 70+ languages on Android via multilingual model
   - RTF (Real-Time Factor) < 0.5x on modern phones
5. **Pre-Process Transcript** — Before AI processing:
   - Apply dictionary corrections (word → correction, case-insensitive word-boundary matching)
   - Replace snippet triggers ("my email" → actual email content)
6. **AI Processing (Gemini)** — Send to `gemini-2.5-flash-lite` via REST API:
   - **AI Mode**: Full content generation with system prompt that includes user's snippets/dictionary as context
   - **Grammar Mode**: Fix spelling, grammar, punctuation only — never changes meaning
   - **Notes Mode**: Saves transcript as a note (no AI processing)
7. **Post-Process** — Apply dictionary corrections again on output (belt-and-suspenders)
8. **Output** — Text is:
   - Committed to the current input field (via InputConnection on Android, clipboard+paste on desktop)
   - Copied to system clipboard
   - Saved to local history (Room DB on Android, localStorage on desktop)
9. **Usage Tracking** — Increment daily/monthly counters (local + cloud via Supabase RPC)

---

## Models Used

### Desktop (Windows/Mac)
| Component | Model | Size | Source |
|-----------|-------|------|--------|
| STT | Whisper Base (English, ggml) | ~142 MB | whisper.cpp via sherpa-onnx-node |
| AI | Gemini 2.5 Flash Lite | Cloud API | Google Generative AI |

### Android
| Component | Model | Size | Source |
|-----------|-------|------|--------|
| STT | Whisper Tiny Multilingual (INT8 ONNX) | ~103 MB | Sherpa-ONNX AAR (v1.12.25) |
| AI | Gemini 2.5 Flash Lite | Cloud API | REST API (Ktor client) |

### Why Different Models?
- Desktop has more RAM/CPU budget → uses Whisper Base for better accuracy
- Android needs to be lightweight → uses Whisper Tiny (INT8 quantized) for speed (~2-3s transcription for 5s audio)
- Both are fully on-device STT — no audio leaves the phone/computer
- AI processing (Gemini) is cloud-based on both platforms

---

## Tech Stack

### Desktop App
- **Framework**: Electron 28
- **Language**: TypeScript
- **UI**: React 18 + Vite 5
- **STT**: sherpa-onnx-node (native Node.js binding)
- **AI**: @google/generative-ai SDK
- **Auth/Cloud**: @supabase/supabase-js
- **Hotkeys**: Electron globalShortcut API
- **Text Injection**: active-win (detect focused window) + clipboard + simulated Ctrl+V
- **Audio**: ffmpeg-static for audio capture and conversion
- **Payments**: Razorpay SDK

### Android App
- **Language**: Kotlin
- **UI**: Jetpack Compose (Material 3)
- **Architecture**: MVVM (ViewModel + StateFlow)
- **Keyboard**: Custom IME (InputMethodService) with Compose UI
- **STT**: Sherpa-ONNX AAR (offline Whisper Tiny)
- **AI**: Ktor HTTP Client → Gemini REST API
- **Local DB**: Room (SQLite) — dictionary, snippets, notes, clipboard history, usage cache
- **Auth/Cloud**: Supabase Kotlin SDK (io.github.jan.supabase) + ComposeAuth for native Google sign-in
- **Navigation**: Jetpack Navigation Compose
- **State**: MutableStateFlow + MutableState (for keyboard)

### Website
- **Framework**: React + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Deployment**: Vercel
- **Build**: TypeScript

### Backend (Supabase)
- **Database**: PostgreSQL
- **Auth**: Supabase Auth (Google OAuth + Email/Password)
- **RLS**: Row Level Security on all tables
- **RPC Functions**: `get_usage_summary`, `increment_usage`, `reset_daily_usage`, `reset_monthly_usage`
- **Tables**: profiles, subscriptions, cloud_dictionary, cloud_snippets, cloud_notes, usage_logs, app_config

---

## Plan System

| Feature | Free Plan | Pro Plan |
|---------|-----------|----------|
| AI Mode | 10/day | 100/day |
| Grammar Mode | 15/day | 100/day |
| Monthly Total | 200/month | 5000/month |
| Cloud Sync | ❌ | ✅ |
| Languages | All | All |
| On-device STT | ✅ | ✅ |
| Dictionary/Snippets | ✅ (local) | ✅ (local + cloud) |

---

## How the Desktop EXE Works

1. **Startup**: Electron main process initializes → registers global hotkeys (F7=AI, F8=Grammar, F9=Notes)
2. **Hotkey Pressed**: 
   - Captures selected text from active window (if any) via active-win
   - Starts recording audio from default mic (via ffmpeg child process)
   - Shows recording indicator overlay
3. **User Stops Speaking** (press hotkey again or auto-silence detection):
   - Stops recording
   - Runs STT locally via sherpa-onnx-node
   - Pre-processes transcript (dict + snippets from localStorage)
   - Sends to Gemini API
   - Pastes result into focused field via clipboard + Ctrl+V simulation
4. **Renderer Process**: React UI for settings, dictionary management, snippets, history, login, subscription

---

## How the Android App Works

### Two Components:
1. **Dashboard App** (MainActivity) — Settings, dictionary, snippets, notes, usage, login
2. **Custom Keyboard** (JuskoeKeyboardService) — IME that replaces system keyboard

### Keyboard Flow:
1. User enables JUSKOE in Android keyboard settings
2. User switches to JUSKOE as active keyboard
3. Full QWERTY layout with:
   - Mode strip at top: AI (swipe right) | Grammar (swipe left) | Notes (tap N)
   - Tool row: emoji, settings, collapse/expand, language picker, clipboard
   - Samsung-style dark keys with press animations
   - Progressive backspace (hold = accelerates: char → word → multi-word)
   - Auto-capitalize at sentence boundaries
   - Autocomplete suggestions (from 800+ common word list)
   - Context-aware action key (Search/Send/Go/Done/Enter based on IME flags)
4. Voice mode activated → recording starts → bigEqualizer animation → processing → result pasted + clipboard

### App Screens:
- **Auth** (Google native sign-in via ComposeAuth, Email/Password)
- **Onboarding** (first-time setup flow)
- **Home** (credits display, quick guide, recent history from Room)
- **Dictionary** (CRUD with Room + optional cloud sync)
- **Snippets** (CRUD with Room + optional cloud sync)
- **Notes** (CRUD with Room + optional cloud sync)
- **Settings** (3 tabs: General, System, Account)

---

## Supabase Database Schema

### Tables:
- `profiles` — User profile (id, email, full_name, plan, usage counters)
- `subscriptions` — Pro subscriptions (Razorpay integration)
- `cloud_dictionary` — User's custom word corrections (user_id, word, correction)
- `cloud_snippets` — User's text expansions (user_id, key, title, content, category)
- `cloud_notes` — User's notes (user_id, text, tags[])
- `usage_logs` — Every AI/Grammar use logged (user_id, mode, created_at)
- `app_config` — Server-side config (Gemini API key, etc.)

### RPC Functions:
- `get_usage_summary()` — Returns daily_ai, daily_grammar, monthly_total, limit_reached
- `increment_usage(p_mode)` — Checks limits, increments if allowed, returns allowed/denied + reason

---

## Security Considerations

- Supabase RLS enforces user-only access to own data
- Gemini API key is obfuscated (char-code array) in Config.kt — not truly secure but prevents casual extraction
- OAuth uses PKCE flow for Google sign-in
- Audio never leaves device (STT is fully on-device)
- Only the processed transcript goes to Gemini cloud API

---

## File Organization (Current State)

```
juskoe/                          ← Root (Desktop Electron app)
├── src/main/                    ← Electron main process (TypeScript)
├── src/renderer/                ← Electron renderer (React)
├── src/shared/                  ← Shared types/utils
├── assets/                      ← Desktop assets (models, logo, whisper binaries)
├── juskoe_android/              ← Android project (Kotlin/Compose)
├── website/                     ← Marketing website (React/Vite/Tailwind)
├── supabase/                    ← Supabase config
├── tests/                       ← Test files
├── build/, dist/, release/      ← Build outputs
├── package.json                 ← Desktop dependencies
├── supabase_schema.sql          ← Database schema
└── .kiro/                       ← Kiro specs
```

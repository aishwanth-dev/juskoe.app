# JUSKOE

**AI Voice Assistant — Just speak, it happens.**

JUSKOE turns your voice into polished, ready-to-use text. Speak naturally and get grammar-corrected, AI-enhanced, or note-ready content — instantly pasted wherever your cursor is.

## Platforms

| Platform | Tech Stack | Status |
|----------|-----------|--------|
| **Desktop** (Win/Mac) | Electron + TypeScript + React | ✅ Working |
| **Android** (App + Keyboard) | Kotlin + Jetpack Compose | 🔧 Beta |
| **Website** | React + Vite + Tailwind | ✅ Live |

## Project Structure

```
juskoe/
├── src/                    ← Desktop Electron app (main + renderer)
├── juskoe_android/         ← Android app + custom keyboard
├── website/                ← Marketing website
├── supabase/               ← Backend config
├── assets/                 ← Desktop models & assets
├── docs/                   ← Documentation
├── tests/                  ← Test files
└── supabase_schema.sql     ← Database schema
```

## Key Features

- 🎤 **On-device STT** — Whisper models via Sherpa-ONNX (no audio leaves your device)
- 🤖 **AI Mode** — Full content generation powered by Gemini 2.5 Flash Lite
- ✍️ **Grammar Mode** — Fix spelling, grammar, punctuation only
- 📝 **Notes Mode** — Voice notes saved locally + cloud
- 📖 **Custom Dictionary** — Teach JUSKOE your names, terms, abbreviations
- 📋 **Snippets** — Text expansions triggered by voice ("my email" → actual email)
- ☁️ **Cloud Sync** (Pro) — Dictionary, snippets, notes synced via Supabase
- ⌨️ **Custom Keyboard** (Android) — Full QWERTY with voice modes built-in

## Backend

- **Database**: Supabase (PostgreSQL)
- **Auth**: Google OAuth + Email/Password
- **AI**: Gemini 2.5 Flash Lite (REST API)
- **Payments**: Razorpay

## Getting Started

### Desktop
```bash
npm install
npm run dev
```

### Android
Open `juskoe_android/` in Android Studio, sync Gradle, and run.

### Website
```bash
cd website
npm install
npm run dev
```

## Documentation

- [About JUSKOE](docs/about_juskoe.md) — Full system overview
- [Android Progress](docs/till_now_completed_android.md) — What's built
- [Roadmap](docs/now_continue_to_work.md) — Bugs, fixes, and features remaining

## License

MIT © 2026 Juskoe

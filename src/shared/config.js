"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_VERSION = exports.APP_NAME = exports.HOTKEY_GRAMMAR_MODE = exports.HOTKEY_AI_MODE = exports.SILENCE_DURATION_MS = exports.SILENCE_THRESHOLD = exports.AUDIO_BIT_DEPTH = exports.AUDIO_CHANNELS = exports.AUDIO_SAMPLE_RATE = exports.OPENAI_API_KEY = exports.GEMINI_MODEL = exports.GEMINI_API_KEY = exports.SUPABASE_ANON_KEY = exports.SUPABASE_URL = void 0;
// Supabase Configuration
exports.SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrromegwhhkyjsfxvesu.supabase.co';
exports.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
// Gemini Configuration
exports.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
exports.GEMINI_MODEL = 'gemini-2.5-flash-lite';
// OpenAI Whisper Configuration (user can add their key)
exports.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
// Audio Configuration
exports.AUDIO_SAMPLE_RATE = 16000;
exports.AUDIO_CHANNELS = 1;
exports.AUDIO_BIT_DEPTH = 16;
exports.SILENCE_THRESHOLD = 0.01;
exports.SILENCE_DURATION_MS = 1500;
// Hotkey Configuration
exports.HOTKEY_AI_MODE = 'Alt+Super'; // Alt + Win
exports.HOTKEY_GRAMMAR_MODE = 'Control+Super'; // Ctrl + Win
// App Configuration
exports.APP_NAME = 'Juskoe';
exports.APP_VERSION = '1.0.0';
//# sourceMappingURL=config.js.map
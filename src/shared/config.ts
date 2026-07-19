// ============================================
// JUSKOE — Configuration
// ============================================

// Supabase
export const SUPABASE_URL = 'https://rrromegwhhkyjsfxvesu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycm9tZWd3aGhreWpzZnh2ZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjM1NDIsImV4cCI6MjA4Njc5OTU0Mn0.m0bJCOLoBFCMnFFhb2SaKoYandShMLxJ90etIDewErE';

// Plan Limits
export const FREE_PLAN_LIMITS = {
    dailyAI: 10,          // F7 calls per day
    dailyGrammar: 15,     // F8 calls per day
    dailyTotal: 25,       // combined per day (10+15)
    monthlyTotal: 200,    // combined per month
};

export const PRO_PLAN_LIMITS = {
    dailyAI: Infinity,
    dailyGrammar: Infinity,
    monthlyTotal: Infinity,
};

// Pricing
export const PRICING = {
    pro: {
        monthly: { inr: 359, usd: 10 },
        annual: { inr: 300, usd: 8 },  // per month, billed yearly
    },
};

// Audio Configuration
export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_BIT_DEPTH = 16;

// App Configuration
export const APP_NAME = 'Juskoe';
export const APP_VERSION = '1.0.0';

// Whisper STT Supported Languages (Sherpa-ONNX Whisper Base)
// These are the 99 languages the model can transcribe/detect
export const WHISPER_LANGUAGES = [
    'Auto',
    'English', 'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Assamese',
    'Azerbaijani', 'Bashkir', 'Basque', 'Belarusian', 'Bengali', 'Bosnian', 'Breton',
    'Bulgarian', 'Burmese', 'Cantonese', 'Catalan', 'Chinese', 'Croatian', 'Czech',
    'Danish', 'Dutch', 'Estonian', 'Faroese', 'Finnish', 'French', 'Galician',
    'Georgian', 'German', 'Greek', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hawaiian',
    'Hebrew', 'Hindi', 'Hungarian', 'Icelandic', 'Indonesian', 'Italian', 'Japanese',
    'Javanese', 'Kannada', 'Kazakh', 'Khmer', 'Korean', 'Lao', 'Latin', 'Latvian',
    'Lingala', 'Lithuanian', 'Luxembourgish', 'Macedonian', 'Malagasy', 'Malay',
    'Malayalam', 'Maltese', 'Maori', 'Marathi', 'Mongolian', 'Nepali', 'Norwegian',
    'Nynorsk', 'Occitan', 'Pashto', 'Persian', 'Polish', 'Portuguese', 'Punjabi',
    'Romanian', 'Russian', 'Sanskrit', 'Serbian', 'Shona', 'Sindhi', 'Sinhala',
    'Slovak', 'Slovenian', 'Somali', 'Spanish', 'Sundanese', 'Swahili', 'Swedish',
    'Tagalog', 'Tajik', 'Tamil', 'Tatar', 'Telugu', 'Thai', 'Tibetan', 'Turkish',
    'Turkmen', 'Ukrainian', 'Urdu', 'Uzbek', 'Vietnamese', 'Welsh', 'Yiddish', 'Yoruba',
];

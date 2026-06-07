package com.juskoe.app.data

import android.content.Context
import android.util.Log
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * On-device Speech-to-Text using Sherpa-ONNX + Whisper Tiny (multilingual, INT8)
 *
 * Supports 99 languages via the multilingual Whisper Tiny model.
 * User-selected language(s) are read from SharedPreferences.
 *
 * Model files in assets/sherpa-onnx-whisper-tiny/:
 *   - tiny-encoder.int8.onnx  (~13 MB)
 *   - tiny-decoder.int8.onnx  (~90 MB)
 *   - tiny-tokens.txt         (~817 KB)
 */
class SherpaSTT(private val context: Context) {

    companion object {
        private const val TAG = "SherpaSTT"
        private const val MODEL_DIR = "sherpa-onnx-whisper-tiny"
        private const val SAMPLE_RATE = 16000
        private const val MAX_SAMPLES = SAMPLE_RATE * 30

        /** All languages supported by Whisper Tiny multilingual model */
        val SUPPORTED_LANGUAGES = listOf(
            "en" to "English",
            "ta" to "Tamil",
            "hi" to "Hindi",
            "te" to "Telugu",
            "kn" to "Kannada",
            "ml" to "Malayalam",
            "mr" to "Marathi",
            "bn" to "Bengali",
            "gu" to "Gujarati",
            "pa" to "Punjabi",
            "ur" to "Urdu",
            "ne" to "Nepali",
            "si" to "Sinhala",
            "ar" to "Arabic",
            "zh" to "Chinese",
            "ja" to "Japanese",
            "ko" to "Korean",
            "fr" to "French",
            "de" to "German",
            "es" to "Spanish",
            "pt" to "Portuguese",
            "it" to "Italian",
            "nl" to "Dutch",
            "ru" to "Russian",
            "pl" to "Polish",
            "tr" to "Turkish",
            "vi" to "Vietnamese",
            "th" to "Thai",
            "id" to "Indonesian",
            "ms" to "Malay",
            "tl" to "Filipino",
            "sv" to "Swedish",
            "da" to "Danish",
            "no" to "Norwegian",
            "fi" to "Finnish",
            "el" to "Greek",
            "he" to "Hebrew",
            "cs" to "Czech",
            "ro" to "Romanian",
            "hu" to "Hungarian",
            "uk" to "Ukrainian",
            "bg" to "Bulgarian",
            "hr" to "Croatian",
            "sk" to "Slovak",
            "lt" to "Lithuanian",
            "lv" to "Latvian",
            "et" to "Estonian",
            "sl" to "Slovenian",
            "fa" to "Persian",
            "sw" to "Swahili",
            "af" to "Afrikaans",
            "cy" to "Welsh",
            "ca" to "Catalan",
            "eu" to "Basque",
            "gl" to "Galician",
            "az" to "Azerbaijani",
            "uz" to "Uzbek",
            "kk" to "Kazakh",
            "mn" to "Mongolian",
            "my" to "Myanmar",
            "km" to "Khmer",
            "lo" to "Lao",
            "ka" to "Georgian",
            "am" to "Amharic",
            "yo" to "Yoruba",
            "so" to "Somali",
            "ha" to "Hausa",
            "su" to "Sundanese",
            "jw" to "Javanese",
        )

        /** Read user's selected languages from SharedPreferences */
        fun getSelectedLanguages(context: Context): List<String> {
            val prefs = context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE)
            val saved = prefs.getString("selected_languages", "en") ?: "en"
            return saved.split(",").filter { it.isNotBlank() }
        }

        /** Save user's selected languages to SharedPreferences */
        fun saveSelectedLanguages(context: Context, languages: List<String>) {
            val prefs = context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("selected_languages", languages.joinToString(",")).apply()
        }
    }

    private var recognizer: OfflineRecognizer? = null
    private var isInitialized = false
    /** Current language the model was initialized with */
    var currentLanguage: String = "en"
        private set

    /**
     * Initialize the offline recognizer with the user's preferred language.
     * Call once from background thread — loads model in ~1-2s on modern phones.
     */
    fun initialize(): Boolean {
        if (isInitialized) return true

        return try {
            val startMs = System.currentTimeMillis()

            // Read user's selected languages
            val selectedLangs = getSelectedLanguages(context)
            // If only 1 language selected → force it. Multiple → auto-detect (empty = Whisper auto-detect)
            currentLanguage = if (selectedLangs.size == 1) selectedLangs.first() else ""

            val langLabel = if (currentLanguage.isEmpty()) "auto-detect" else currentLanguage
            Log.d(TAG, "Initializing Sherpa-ONNX Whisper Tiny (multilingual, lang=$langLabel)...")

            val config = OfflineRecognizerConfig(
                featConfig = FeatureConfig(
                    sampleRate = SAMPLE_RATE,
                    featureDim = 80,
                ),
                modelConfig = OfflineModelConfig(
                    whisper = OfflineWhisperModelConfig(
                        encoder = "$MODEL_DIR/tiny-encoder.int8.onnx",
                        decoder = "$MODEL_DIR/tiny-decoder.int8.onnx",
                        language = currentLanguage,  // "" = auto-detect
                        task = "transcribe",
                        tailPaddings = 300,
                    ),
                    tokens = "$MODEL_DIR/tiny-tokens.txt",
                    modelType = "whisper",
                    numThreads = 4,
                    debug = false,
                    provider = "cpu",
                ),
                decodingMethod = "greedy_search",
            )

            recognizer = OfflineRecognizer(
                assetManager = context.assets,
                config = config,
            )

            isInitialized = true
            val elapsed = System.currentTimeMillis() - startMs
            Log.d(TAG, "Sherpa-ONNX recognizer initialized in ${elapsed}ms (lang=$currentLanguage)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize recognizer", e)
            isInitialized = false
            false
        }
    }

    /**
     * Re-initialize with a new language.
     * Call when user changes language preferences.
     */
    fun reinitializeWithLanguage(language: String): Boolean {
        if (currentLanguage == language && isInitialized) return true
        release()
        val selectedLangs = getSelectedLanguages(context)
        // Temporarily override
        val prefs = context.getSharedPreferences("juskoe_prefs", Context.MODE_PRIVATE)
        if (selectedLangs.firstOrNull() != language) {
            // Put the requested language first
            val newLangs = listOf(language) + selectedLangs.filter { it != language }
            prefs.edit().putString("selected_languages", newLangs.joinToString(",")).apply()
        }
        return initialize()
    }

    /**
     * Transcribe raw PCM audio data (16-bit, 16kHz, mono) to text.
     */
    fun transcribe(pcmData: ByteArray): String {
        val rec = recognizer ?: run {
            Log.w(TAG, "Recognizer not initialized, attempting lazy init...")
            if (!initialize()) return ""
            recognizer ?: return ""
        }

        return try {
            val startMs = System.currentTimeMillis()
            var samples = pcmToFloat32(pcmData)

            if (samples.isEmpty()) {
                Log.w(TAG, "No audio samples to transcribe")
                return ""
            }

            if (samples.size > MAX_SAMPLES) {
                samples = samples.copyOfRange(0, MAX_SAMPLES)
            }

            val durationSec = samples.size.toFloat() / SAMPLE_RATE
            Log.d(TAG, "Transcribing ${samples.size} samples (${String.format("%.1f", durationSec)}s, lang=$currentLanguage)")

            val stream = rec.createStream()
            stream.acceptWaveform(samples, SAMPLE_RATE)
            rec.decode(stream)
            val result = rec.getResult(stream)
            stream.release()

            val text = result.text.trim()
            val elapsed = System.currentTimeMillis() - startMs
            val rtf = if (durationSec > 0) elapsed / (durationSec * 1000) else 0f

            Log.d(TAG, "Transcription done in ${elapsed}ms (RTF=${String.format("%.2f", rtf)}): \"$text\"")
            text
        } catch (e: Exception) {
            Log.e(TAG, "Transcription failed", e)
            ""
        }
    }

    /**
     * Transcribe Float32 samples directly (already normalized to [-1, 1])
     */
    fun transcribeFloat(samples: FloatArray): String {
        val rec = recognizer ?: run {
            if (!initialize()) return ""
            recognizer ?: return ""
        }

        return try {
            val startMs = System.currentTimeMillis()
            val capped = if (samples.size > MAX_SAMPLES) samples.copyOfRange(0, MAX_SAMPLES) else samples

            val stream = rec.createStream()
            stream.acceptWaveform(capped, SAMPLE_RATE)
            rec.decode(stream)
            val result = rec.getResult(stream)
            stream.release()

            val text = result.text.trim()
            Log.d(TAG, "Transcription done in ${System.currentTimeMillis() - startMs}ms: \"$text\"")
            text
        } catch (e: Exception) {
            Log.e(TAG, "Transcription failed", e)
            ""
        }
    }

    /**
     * Convert PCM Int16 bytes (little-endian) to Float32 samples [-1.0, 1.0]
     * Also trims leading/trailing near-silence to speed up processing.
     */
    private fun pcmToFloat32(pcmData: ByteArray): FloatArray {
        if (pcmData.size < 2) return floatArrayOf()

        val shortBuffer = ByteBuffer.wrap(pcmData)
            .order(ByteOrder.LITTLE_ENDIAN)
            .asShortBuffer()
        val numSamples = shortBuffer.remaining()
        val samples = FloatArray(numSamples)
        for (i in 0 until numSamples) {
            samples[i] = shortBuffer.get(i).toFloat() / 32768f
        }

        val threshold = 0.01f
        var start = 0
        var end = samples.size - 1

        while (start < end && kotlin.math.abs(samples[start]) < threshold) start++
        while (end > start && kotlin.math.abs(samples[end]) < threshold) end--

        val pad = 6400
        start = maxOf(0, start - pad)
        end = minOf(samples.size - 1, end + pad)

        return if (end - start < SAMPLE_RATE / 4) {
            floatArrayOf()
        } else {
            samples.copyOfRange(start, end + 1)
        }
    }

    /**
     * Release resources (call from service onDestroy)
     */
    fun release() {
        try {
            recognizer?.release()
            recognizer = null
            isInitialized = false
            Log.d(TAG, "Recognizer released")
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing recognizer", e)
        }
    }
}

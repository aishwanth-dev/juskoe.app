package com.juskoe.app.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Audio Recorder — records PCM audio for STT
 * Outputs 16kHz mono 16-bit WAV (same as Electron app)
 */
class AudioRecorder(private val context: Context) {

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var pcmBuffer = ByteArrayOutputStream()

    /** Optional listener fed a normalized 0..1 amplitude per audio frame. */
    var amplitudeListener: ((Float) -> Unit)? = null

    private val sampleRate = Config.AUDIO_SAMPLE_RATE
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT

    fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun startRecording(): Boolean {
        if (!hasPermission()) return false

        val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
        if (bufferSize == AudioRecord.ERROR_BAD_VALUE) return false

        try {
            audioRecord = AudioRecord(
                // VOICE_RECOGNITION: tuned by the system for STT — better AGC,
                // less aggressive noise gating than MIC, and known to behave
                // better when JUSKOE is recording from a foreground service
                // while another app is in the foreground.
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize * 2,
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                audioRecord?.release()
                audioRecord = null
                return false
            }

            pcmBuffer.reset()
            audioRecord?.startRecording()
            isRecording = true

            // Background thread to read audio data
            Thread {
                val buffer = ByteArray(bufferSize)
                while (isRecording) {
                    val bytesRead = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (bytesRead > 0) {
                        synchronized(pcmBuffer) {
                            pcmBuffer.write(buffer, 0, bytesRead)
                        }
                        // Emit a normalized amplitude (peak of this frame) for the UI.
                        amplitudeListener?.let { listener ->
                            var peak = 0
                            var i = 0
                            while (i + 1 < bytesRead) {
                                val sample = (buffer[i].toInt() and 0xff) or (buffer[i + 1].toInt() shl 8)
                                val abs = kotlin.math.abs(sample)
                                if (abs > peak) peak = abs
                                i += 2
                            }
                            listener(peak / 32768f)
                        }
                    }
                }
            }.start()

            return true
        } catch (e: SecurityException) {
            return false
        }
    }

    fun stopRecording(): ByteArray {
        isRecording = false
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null

        synchronized(pcmBuffer) {
            return pcmBuffer.toByteArray()
        }
    }

    /**
     * Convert PCM data to WAV file
     * Same format as Electron app: 16kHz, mono, 16-bit
     */
    suspend fun saveAsWav(pcmData: ByteArray, outputFile: File): File = withContext(Dispatchers.IO) {
        val totalDataLen = pcmData.size + 36
        val totalAudioLen = pcmData.size.toLong()
        val channels = 1
        val byteRate = (sampleRate * channels * 16 / 8).toLong()
        val blockAlign = (channels * 16 / 8).toShort()

        FileOutputStream(outputFile).use { fos ->
            // WAV header
            val header = ByteBuffer.allocate(44).apply {
                order(ByteOrder.LITTLE_ENDIAN)
                // RIFF chunk
                put("RIFF".toByteArray())
                putInt(totalDataLen)
                put("WAVE".toByteArray())
                // fmt sub-chunk
                put("fmt ".toByteArray())
                putInt(16) // sub-chunk size
                putShort(1) // PCM format
                putShort(channels.toShort())
                putInt(sampleRate)
                putInt(byteRate.toInt())
                putShort(blockAlign)
                putShort(16) // bits per sample
                // data sub-chunk
                put("data".toByteArray())
                putInt(pcmData.size)
            }
            fos.write(header.array())
            fos.write(pcmData)
        }

        outputFile
    }

    /**
     * Get Float32 samples from PCM data (for Sherpa-ONNX)
     */
    fun pcmToFloat32(pcmData: ByteArray): FloatArray {
        val shortBuffer = ByteBuffer.wrap(pcmData).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
        val samples = FloatArray(shortBuffer.remaining())
        for (i in samples.indices) {
            samples[i] = shortBuffer.get(i).toFloat() / 32768f
        }
        return samples
    }
}

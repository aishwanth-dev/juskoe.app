package com.juskoe.app.floating

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View

/**
 * Voice amplitude visualization shown inside the cloud during LISTENING.
 * A small row of bars that scroll left as new amplitude samples arrive.
 */
class VoiceBarsView(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {

    private val barCount = 5
    private val amplitudes = FloatArray(barCount) { 0.1f }
    private val barPaint = Paint().apply {
        color = Color.parseColor("#4285F4") // brand blue
        style = Paint.Style.FILL
        isAntiAlias = true
    }
    private val cornerRadius = 4f

    /** Push a new normalized amplitude (0..1); bars scroll left. */
    fun setAmplitude(amp: Float) {
        for (i in 0 until barCount - 1) amplitudes[i] = amplitudes[i + 1]
        amplitudes[barCount - 1] = amp.coerceIn(0.05f, 1f)
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        // barCount bars + (barCount+1) gaps of equal width
        val unit = w / (barCount * 2 + 1)
        for (i in 0 until barCount) {
            val barHeight = (h * amplitudes[i]).coerceAtLeast(unit) // min visible
            val left = unit + i * (unit * 2)
            val top = (h - barHeight) / 2f // center vertically
            canvas.drawRoundRect(left, top, left + unit, top + barHeight, cornerRadius, cornerRadius, barPaint)
        }
    }
}

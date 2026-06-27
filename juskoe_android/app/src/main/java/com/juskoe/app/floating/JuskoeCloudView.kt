package com.juskoe.app.floating

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import com.juskoe.app.R

/**
 * JUSKOE Cloud — the floating circular overlay that lives beside the caret.
 * Self-contained: white circle + logo, with state-driven animations that all
 * happen *inside* the cloud (breathing, voice bars, spin, success glow, error
 * shake). Uses only real Android APIs (elevation for shadow, not setShadow).
 */
class JuskoeCloudView(context: Context, attrs: AttributeSet? = null) : FrameLayout(context, attrs) {

    enum class CloudState { IDLE, LISTENING, PROCESSING, SUCCESS, ERROR }

    interface CloudInteractionListener {
        fun onSingleTap()
        fun onDoubleTap()
        fun onLongPress()
        fun onRetry()
    }

    var interactionListener: CloudInteractionListener? = null

    private val logoImageView: ImageView
    private val backdropView: View
    private val voiceBarsView: VoiceBarsView
    private val retryImageView: ImageView
    private val offlineBadge: TextView

    private var currentState = CloudState.IDLE
    private var breathAnimator: ValueAnimator? = null
    private var spinAnimator: ObjectAnimator? = null

    init {
        val sizePx = dpToPx(CLOUD_SIZE_DP)
        layoutParams = LayoutParams(sizePx, sizePx)
        // When added directly to WindowManager the params above are ignored, so
        // enforce a real minimum size (reliable touch target) and don't clip the
        // retry icon / offline badge that sit outside bounds.
        minimumWidth = sizePx
        minimumHeight = sizePx
        clipChildren = false
        clipToPadding = false
        // No giant opaque white orb on the root — the small logo IS the cloud.

        // Subtle translucent circle sitting behind the logo so it reads as a
        // soft "cloud" without a heavy white background.
        backdropView = View(context).apply {
            layoutParams = LayoutParams(dpToPx(LOGO_SIZE_DP), dpToPx(LOGO_SIZE_DP), Gravity.CENTER)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.argb(40, 255, 255, 255))
            }
        }

        logoImageView = ImageView(context).apply {
            layoutParams = LayoutParams(dpToPx(LOGO_SIZE_DP), dpToPx(LOGO_SIZE_DP), Gravity.CENTER)
            setImageResource(getCloudLogoRes(context))
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        voiceBarsView = VoiceBarsView(context).apply {
            layoutParams = LayoutParams(dpToPx(LOGO_SIZE_DP), dpToPx(LOGO_SIZE_DP), Gravity.CENTER)
            visibility = GONE
        }
        retryImageView = ImageView(context).apply {
            layoutParams = LayoutParams(dpToPx(24), dpToPx(24), Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply {
                topMargin = -dpToPx(30)
            }
            setImageResource(android.R.drawable.ic_menu_rotate)
            visibility = GONE
            setOnClickListener { interactionListener?.onRetry() }
        }
        offlineBadge = TextView(context).apply {
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply {
                bottomMargin = -dpToPx(18)
            }
            text = context.getString(R.string.offline_badge)
            textSize = 10f
            setTextColor(Color.RED)
            visibility = GONE
        }

        addView(backdropView)
        addView(logoImageView)
        addView(voiceBarsView)
        addView(retryImageView)
        addView(offlineBadge)

        isFocusable = false
        isFocusableInTouchMode = false

        post { setState(CloudState.IDLE) }
    }

    // Gestures: single tap (AI), double tap (Grammar), long press (menu).
    private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
            interactionListener?.onSingleTap(); return true
        }
        override fun onDoubleTap(e: MotionEvent): Boolean {
            interactionListener?.onDoubleTap(); return true
        }
        override fun onLongPress(e: MotionEvent) {
            interactionListener?.onLongPress()
        }
    })

    /**
     * Consume touches only inside the circular touch target; anything in the
     * square's corners passes through to the app underneath the overlay.
     */
    override fun onTouchEvent(event: MotionEvent): Boolean {
        val cx = width / 2f
        val cy = height / 2f
        val radius = minOf(width, height) / 2f
        val dx = event.x - cx
        val dy = event.y - cy
        if (dx * dx + dy * dy > radius * radius) return false // pass through
        return gestureDetector.onTouchEvent(event)
    }

    // ── Public API ──

    fun setState(state: CloudState) {
        currentState = state
        cancelAllAnimations()
        transitionTo(state)
    }

    fun getCurrentState(): CloudState = currentState

    fun setAmplitude(amp: Float) {
        if (currentState == CloudState.LISTENING) voiceBarsView.setAmplitude(amp.coerceIn(0f, 1f))
    }

    fun setOfflineBadge(visible: Boolean) {
        offlineBadge.visibility = if (visible) VISIBLE else GONE
    }

    fun setRetryVisible(visible: Boolean) {
        retryImageView.visibility = if (visible) VISIBLE else GONE
    }

    fun showRetry() = setRetryVisible(true)
    fun hideRetry() = setRetryVisible(false)

    // ── Transitions ──

    private fun transitionTo(state: CloudState) {
        logoImageView.animate().cancel()
        animate().cancel()
        logoImageView.clearColorFilter()
        scaleX = 1f; scaleY = 1f; translationX = 0f
        logoImageView.rotation = 0f

        when (state) {
            CloudState.IDLE -> {
                logoImageView.visibility = VISIBLE
                voiceBarsView.visibility = GONE
                startBreathingAnimation()
            }
            CloudState.LISTENING -> {
                logoImageView.visibility = GONE
                voiceBarsView.visibility = VISIBLE
                retryImageView.visibility = GONE // new interaction invalidates old retry
            }
            CloudState.PROCESSING -> {
                logoImageView.visibility = VISIBLE
                voiceBarsView.visibility = GONE
                retryImageView.visibility = GONE
                startSpinAnimation()
            }
            CloudState.SUCCESS -> {
                logoImageView.visibility = VISIBLE
                voiceBarsView.visibility = GONE
                startSuccessGlow()
            }
            CloudState.ERROR -> {
                logoImageView.visibility = VISIBLE
                voiceBarsView.visibility = GONE
                startErrorShake()
            }
        }
    }

    private fun cancelAllAnimations() {
        breathAnimator?.cancel(); breathAnimator = null
        spinAnimator?.cancel(); spinAnimator = null
    }

    private fun startBreathingAnimation() {
        breathAnimator = ValueAnimator.ofFloat(1f, 1.03f).apply {
            duration = 2000
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener { val s = it.animatedValue as Float; scaleX = s; scaleY = s }
            start()
        }
    }

    private fun startSpinAnimation() {
        spinAnimator = ObjectAnimator.ofFloat(logoImageView, "rotation", 0f, 360f).apply {
            duration = 1000
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            start()
        }
    }

    private fun startSuccessGlow() {
        logoImageView.colorFilter = PorterDuffColorFilter(Color.argb(120, 0, 200, 0), PorterDuff.Mode.SRC_ATOP)
        scaleX = 1.15f; scaleY = 1.15f
        animate().scaleX(1f).scaleY(1f).setDuration(600).withEndAction {
            logoImageView.clearColorFilter()
            setState(CloudState.IDLE)
        }.start()
    }

    private fun startErrorShake() {
        logoImageView.colorFilter = PorterDuffColorFilter(Color.argb(180, 220, 0, 0), PorterDuff.Mode.SRC_ATOP)
        ValueAnimator.ofFloat(0f, 10f, -10f, 8f, -8f, 5f, -5f, 0f).apply {
            duration = 400
            addUpdateListener { translationX = it.animatedValue as Float }
            start()
        }
    }

    private fun dpToPx(dp: Int): Int = (dp * context.resources.displayMetrics.density).toInt()

    companion object {
        const val CLOUD_SIZE_DP = 56
        const val LOGO_SIZE_DP = 44

        /** ic_cloud if the designer has added it, else the existing logo. */
        fun getCloudLogoRes(context: Context): Int {
            val icCloud = context.resources.getIdentifier("ic_cloud", "drawable", context.packageName)
            return if (icCloud != 0) icCloud else R.drawable.juskoe_logo
        }
    }
}

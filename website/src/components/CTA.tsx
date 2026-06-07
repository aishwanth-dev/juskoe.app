import { motion } from "framer-motion";
import ShinyText from "./ShinyText";
import BlurText from "./BlurText";

const CTA = () => {
  return (
    <section id="cta" className="py-32 md:py-40 px-6 relative overflow-hidden">
      {/* Purple blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[rgba(124,58,237,0.07)] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[rgba(124,58,237,0.05)] rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative z-10 max-w-3xl mx-auto text-center"
      >
        <div className="flex justify-center mb-6">
          <span className="badge-purple">Start today — free</span>
        </div>

        <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 text-[#2e2d2d]">
          Start
          <br />
          <span className="font-serif-italic italic-shine">
            <ShinyText text="speaking." speed={4} color="#2e2d2d" shineColor="#7C3AED" />
          </span>
        </h2>

        <div className="flex justify-center mb-8 mt-4">
          <BlurText
            text="Download juskoe and experience voice-first productivity. Works on Windows and Mac."
            delay={50}
            className="text-[#2e2d2d]/55 text-lg max-w-xl justify-center"
            direction="bottom"
            stepDuration={0.25}
          />
        </div>

        {/* Rectangle Framer-style buttons */}
        <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <motion.a
            href="https://firebasestorage.googleapis.com/v0/b/juskoe-7698d.firebasestorage.app/o/Juskoe%20Setup%201.0.0.exe?alt=media&token=28f7ccbe-c1e6-4996-9e13-45700324f5f3"
            whileHover={{ scale: 1.04, boxShadow: "0 16px 50px rgba(124,58,237,0.3)" }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2.5 px-10 py-4 bg-[#2e2d2d] text-white font-bold text-base transition-all"
            style={{ borderRadius: 10 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" /></svg>
            Download for Windows
          </motion.a>
          <motion.span
            className="inline-flex items-center gap-2.5 px-10 py-4 border-2 border-[#2e2d2d]/20 text-[#2e2d2d]/40 font-bold text-base cursor-default"
            style={{ borderRadius: 10 }}
          >
            <svg className="w-5 h-5 opacity-40" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
            Mac — Coming Soon
          </motion.span>
        </motion.div>

        <p className="text-xs text-[#2e2d2d]/35">
          Free during early access · No credit card required · Windows 10+ & macOS 12+
        </p>
      </motion.div>
    </section>
  );
};

export default CTA;

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
// Windows & Apple brand SVGs used inline below
import BlurText from "./BlurText";
import ShinyText from "./ShinyText";
import appHero from "@/assets/app-hero.png";

// Scrolling words that cycle through
const aiWords = ["leave application", "cold email", "meeting summary", "product brief", "LinkedIn post"];
const gWords = ["cleaned up", "polished", "grammar fixed", "professional", "ready to send"];

const OverlayPillDemo = () => {
  const [state, setState] = useState<
    "idle" | "ai-listening" | "ai-processing" | "ai-done" | "g-listening" | "g-processing" | "g-done"
  >("idle");
  const [wordIdx, setWordIdx] = useState(0);
  const [gWordIdx, setGWordIdx] = useState(0);

  useEffect(() => {
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    const runCycle = () => {
      setWordIdx(i => (i + 1) % aiWords.length);
      setGWordIdx(i => (i + 1) % gWords.length);
      timeouts = [
        setTimeout(() => setState("ai-listening"), 300),
        setTimeout(() => setState("ai-processing"), 2500),
        setTimeout(() => setState("ai-done"), 4000),
        setTimeout(() => setState("idle"), 5800),
        setTimeout(() => setState("g-listening"), 6600),
        setTimeout(() => setState("g-processing"), 8600),
        setTimeout(() => setState("g-done"), 10200),
        setTimeout(() => setState("idle"), 12000),
      ];
    };

    runCycle();
    const interval = setInterval(runCycle, 12500);
    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  const isActive = state !== "idle";
  const isAI = state.startsWith("ai");
  const isListening = state === "ai-listening" || state === "g-listening";
  const isProcessing = state === "ai-processing" || state === "g-processing";
  const isDone = state === "ai-done" || state === "g-done";

  return (
    <motion.div
      animate={{ opacity: isActive ? 1 : 0.4 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-3"
    >
      <div className="overlay-pill-wrapper" style={{ width: 220, height: 52 }}>
        {state === "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ width: 50, height: 5, borderRadius: 3, background: "#2e2d2d", opacity: 0.22 }}
          />
        )}

        {isActive && (
          <motion.div
            initial={{ scale: 0.82, opacity: 0, width: 50 }}
            animate={{
              scale: 1,
              opacity: 1,
              width: isDone ? 120 : isListening ? 180 : 160,
            }}
            exit={{ scale: 0.82, opacity: 0, width: 50 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="overlay-demo-pill"
            style={{
              background: "#ffffff",
              border: `2px solid ${isAI ? "#2e2d2d" : isProcessing ? "#d97706" : "#2e2d2d"}`,
              boxShadow: isProcessing ? "0 3px 16px rgba(217,119,6,0.2)" : "0 3px 12px rgba(0,0,0,0.15)",
            }}
          >
            {(state === "ai-listening" || state === "ai-processing") && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2e2d2d", fontFamily: "Inter, sans-serif", letterSpacing: "0.5px" }}>
                AI
              </span>
            )}
            {(state === "g-listening" || state === "g-processing") && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2e2d2d", fontFamily: "Inter, sans-serif", letterSpacing: "0.5px" }}>
                G
              </span>
            )}

            {isListening && (
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="wave-bar-demo"
                    style={{
                      background: "#2e2d2d",
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {isProcessing && (
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="wave-bar-demo"
                    style={{
                      background: "#d97706",
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: "0.5s",
                    }}
                  />
                ))}
              </div>
            )}

            {isDone && (
              <AnimatePresence mode="wait">
                <motion.span
                  key="brand"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#2e2d2d",
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.01em",
                  }}
                >
                  juskoe
                </motion.span>
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </div>

      {/* Scrolling text description below pill */}
      <div style={{ height: 24, overflow: "hidden", minWidth: 240, textAlign: "center" }}>
        <AnimatePresence mode="wait">
          {state === "ai-listening" && (
            <motion.span
              key={`ai-listen-${wordIdx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-xs text-[#2e2d2d]/40 font-medium"
            >
              Listening... "write a {aiWords[wordIdx]}"
            </motion.span>
          )}
          {state === "ai-processing" && (
            <motion.span key="ai-proc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="text-xs text-[#d97706]/70 font-medium">
              AI generating...
            </motion.span>
          )}
          {state === "ai-done" && (
            <motion.span key="ai-done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="text-xs text-[#059669]/70 font-medium">
              ✓ Pasted to cursor
            </motion.span>
          )}
          {state === "g-listening" && (
            <motion.span key={`g-listen-${gWordIdx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="text-xs text-[#2e2d2d]/40 font-medium">
              Listening... speech detected
            </motion.span>
          )}
          {state === "g-processing" && (
            <motion.span key="g-proc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="text-xs text-[#d97706]/70 font-medium">
              Grammar refining...
            </motion.span>
          )}
          {state === "g-done" && (
            <motion.span key="g-done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="text-xs text-[#059669]/70 font-medium">
              ✓ {gWords[gWordIdx]} — pasted
            </motion.span>
          )}
          {state === "idle" && (
            <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="text-xs text-[#2e2d2d]/25 font-medium">
              Press F7 or F8 to begin
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const Hero = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });

  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.96]);
  const imgRotateX = useTransform(scrollYProgress, [0, 0.5], [10, 0]);
  const imgScale = useTransform(scrollYProgress, [0, 0.5], [0.94, 1]);
  const imgY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden pt-32 md:pt-40 pb-0"
    >
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[rgba(124,58,237,0.06)] blur-3xl pointer-events-none animate-blob" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[rgba(124,58,237,0.05)] blur-3xl pointer-events-none animate-blob" style={{ animationDelay: "3s" }} />

      <motion.div style={{ y, opacity, scale }} className="relative z-10 text-center max-w-4xl mx-auto px-6">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="badge-purple">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />
            juskoe — Press a key. Speak. Done.
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.05] mb-2 text-[#2e2d2d]">
            Just <span className="font-serif-italic italic-shine"><ShinyText text="voice," speed={4} color="#2e2d2d" shineColor="#7C3AED" /></span>
          </h1>
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.05] mb-8 text-[#2e2d2d]">
            Nothing else.
          </h1>
        </motion.div>

        {/* Overlay pill demo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center mb-8"
        >
          <OverlayPillDemo />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
        >
          <BlurText
            text="juskoe is a system-wide voice layer. Press a hotkey, speak naturally, and get polished text pasted anywhere instantly."
            delay={60}
            className="text-lg md:text-xl text-[#2e2d2d]/60 max-w-2xl mx-auto mb-10 leading-relaxed justify-center"
            direction="bottom"
            stepDuration={0.3}
          />
        </motion.div>

        {/* CTA buttons — Framer rectangle style (less corners) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4"
        >
          <motion.a
            href="https://firebasestorage.googleapis.com/v0/b/juskoe-7698d.firebasestorage.app/o/Juskoe%20Setup%201.0.0.exe?alt=media&token=28f7ccbe-c1e6-4996-9e13-45700324f5f3"
            whileHover={{ backgroundColor: "#2e1a0e", boxShadow: "0 8px 32px rgba(26,10,14,0.35)" }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 text-white font-bold text-sm transition-all"
            style={{ background: "#2e2d2d", borderRadius: 8, letterSpacing: "0.01em" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" /></svg>
            Download for Windows
          </motion.a>
          <span
            className="inline-flex items-center gap-2.5 px-8 py-3.5 font-bold text-sm border-2 border-[#2e2d2d]/20 text-[#2e2d2d]/40 cursor-default"
            style={{ borderRadius: 8, letterSpacing: "0.01em" }}
          >
            <svg className="w-4 h-4 opacity-40" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
            Mac — Coming Soon
          </span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs text-[#2e2d2d]/40"
        >
          Free early access · No credit card required · Windows 10+ & macOS 12+
        </motion.p>
      </motion.div>

      {/* App mockup — half-visible, bottom seamlessly blends */}
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.9 }}
        style={{ rotateX: imgRotateX, scale: imgScale, y: imgY, marginBottom: -2 }}
        className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16"
      >
        <div
          className="relative rounded-t-2xl overflow-hidden"
          style={{
            boxShadow: "0 30px 100px rgba(124,58,237,0.15), 0 4px 20px rgba(0,0,0,0.08)",
            border: "1px solid rgba(124,58,237,0.15)",
            borderBottom: "none",
            maxHeight: "55vh",
          }}
        >
          <img
            src={appHero}
            alt="juskoe app interface"
            className="w-full rounded-t-2xl"
            style={{ display: "block", minHeight: 200, transform: "scale(1.02)", transformOrigin: "top center" }}
          />
          {/* Fade-out gradient at bottom — matches section bg */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "60%",
              background: "linear-gradient(to bottom, transparent 0%, rgba(237,233,254,0.15) 30%, rgba(237,233,254,0.5) 55%, #ede9fe 85%, #ede9fe 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;

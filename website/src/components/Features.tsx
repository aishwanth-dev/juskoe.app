import { motion, AnimatePresence, useInView } from "framer-motion";
import { Sparkles, Mic, FileText, Wand2, BookOpen, Code, Check, Globe } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import ShinyText from "./ShinyText";
import { ParticleCard } from "./MagicBento";

const modes = [
  {
    hotkey: "F7",
    color: "#7C3AED",
    bg: "rgba(124,58,237,0.07)",
    border: "rgba(124,58,237,0.15)",
    glowColor: "rgba(124,58,237,0.18)",
    icon: Sparkles,
    title: "AI Mode",
    tagline: "Speak → get polished output",
    description: "Say your intent. juskoe generates clean text and pastes it at your cursor.",
    side: "left",
  },
  {
    hotkey: "F8",
    color: "#059669",
    bg: "rgba(5,150,105,0.07)",
    border: "rgba(5,150,105,0.15)",
    glowColor: "rgba(5,150,105,0.18)",
    icon: Mic,
    title: "Grammar Mode",
    tagline: "Speak raw → paste polished",
    description: "Speak naturally. juskoe fixes grammar and filler words, pastes clean text.",
    side: "right",
  },
  {
    hotkey: "F9",
    color: "#D97706",
    bg: "rgba(217,119,6,0.07)",
    border: "rgba(217,119,6,0.15)",
    glowColor: "rgba(217,119,6,0.18)",
    icon: FileText,
    title: "Notes Mode",
    tagline: "Speak → saved forever",
    description: "Voice notes that save automatically. No typing, no app switching.",
    side: "left",
  },
  {
    hotkey: "Select+F7",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.07)",
    border: "rgba(59,130,246,0.15)",
    glowColor: "rgba(59,130,246,0.18)",
    icon: Wand2,
    title: "Rewrite Mode",
    tagline: "Select text → rewrite it",
    description: "Highlight any text, press F7, and tell juskoe how to transform it. Rewrite, summarize, translate — instantly.",
    side: "right",
  },
];

// Animated selection highlight bar for Rewrite mode
const SelectionBar = () => (
  <div style={{ display: "flex", gap: 2, alignItems: "center", height: 16 }}>
    {[0,1,2,3,4,5,6,7].map(i => (
      <div
        key={i}
        style={{
          width: 3,
          height: 14,
          borderRadius: 2,
          background: "#3B82F6",
          animation: `selectPulse 1.2s ease-in-out infinite`,
          animationDelay: `${i * 0.08}s`,
          opacity: 0.3 + (i / 8) * 0.7,
        }}
      />
    ))}
  </div>
);

// Animated overlay pill for each mode card — only animates when in view
const ModePill = ({ mode, isInView }: { mode: typeof modes[0]; isInView: boolean }) => {
  const [phase, setPhase] = useState<"idle" | "listening" | "processing" | "done">("idle");

  useEffect(() => {
    if (!isInView) {
      setPhase("idle");
      return;
    }
    let ts: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      ts = [
        setTimeout(() => setPhase("listening"), 400),
        setTimeout(() => setPhase("processing"), 2200),
        setTimeout(() => setPhase("done"), 3600),
        setTimeout(() => setPhase("idle"), 5200),
      ];
    };
    cycle();
    const iv = setInterval(cycle, 5800);
    return () => { ts.forEach(clearTimeout); clearInterval(iv); };
  }, [isInView]);

  const isAI = mode.hotkey === "F7";
  const isGrammar = mode.hotkey === "F8";
  const isRewrite = mode.hotkey === "Select+F7";
  const modeLabel = isRewrite ? "RW" : isAI ? "AI" : isGrammar ? "G" : "N";
  const barColor = phase === "processing" ? "#d97706" : mode.color;
  const pillBorder = phase === "processing" ? "#d97706" : "#2e2d2d";
  const pillBg = phase === "processing" ? "#fffbeb" : "#ffffff";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ width: 200, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {phase === "idle" ? (
          <div style={{ width: 50, height: 5, borderRadius: 3, background: "#2e2d2d", opacity: 0.22 }} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 18px",
                borderRadius: 999,
                background: pillBg,
                border: `2px solid ${pillBorder}`,
                boxShadow: phase === "processing" ? "0 3px 16px rgba(217,119,6,0.2)" : "0 3px 12px rgba(0,0,0,0.12)",
                minWidth: phase === "done" ? 90 : 130,
                justifyContent: "center",
              }}
            >
              {phase !== "done" && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#2e2d2d", fontFamily: "Inter, sans-serif", letterSpacing: "0.5px" }}>
                  {modeLabel}
                </span>
              )}
              {isRewrite && phase === "listening" && (
                <SelectionBar />
              )}
              {(isRewrite ? phase === "processing" : (phase === "listening" || phase === "processing")) && (
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="wave-bar-demo"
                      style={{ background: barColor, animationDelay: `${i * 0.12}s`, animationDuration: phase === "processing" ? "0.5s" : "0.8s" }}
                    />
                  ))}
                </div>
              )}
              {phase === "done" && (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#2e2d2d", fontFamily: "Inter, sans-serif", letterSpacing: "0.01em" }}>
                  juskoe
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <span style={{ fontSize: 11, color: "#2e2d2d", opacity: 0.35, fontFamily: "Inter, sans-serif" }}>
        {phase === "idle" && "ready"}
        {isRewrite && phase === "listening" && "selecting..."}
        {!isRewrite && phase === "listening" && "listening..."}
        {phase === "processing" && "generating..."}
        {phase === "done" && "✓ pasted"}
      </span>
    </div>
  );
};

// Card with MagicBento-style glow, particles, scroll-triggered pill
const CARD_GLOW_COLOR = '210, 210, 225';

const ModeCard = ({ mode, index }: { mode: typeof modes[0]; index: number }) => {
  const isRight = mode.side === "right";
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: false, margin: "-100px" });

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, x: isRight ? 50 : -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col ${isRight ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-10 md:gap-16`}
    >
      {/* Text side */}
      <div className={`flex-1 ${isRight ? "md:text-right" : ""}`}>
        <div className={`flex items-center gap-3 mb-4 ${isRight ? "md:justify-end" : ""}`}>
          <span
            className="px-3 py-1.5 text-white text-xs font-bold tracking-widest font-mono"
            style={{ background: mode.color, borderRadius: 8 }}
          >
            {mode.hotkey}
          </span>
          <span className="text-xs font-semibold" style={{ color: mode.color }}>{mode.tagline}</span>
        </div>

        <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-3 leading-tight">
          {mode.title}
        </h3>

        <p className="text-white/50 leading-relaxed max-w-md text-base" style={isRight ? { marginLeft: "auto" } : {}}>
          {mode.description}
        </p>
      </div>

      {/* Card side — uses ParticleCard for glow/particles */}
      <div className="flex-1 w-full max-w-sm">
        <ParticleCard
          className="magic-bento-card--border-glow"
          glowColor={CARD_GLOW_COLOR}
          style={{
            borderRadius: 20,
            border: '1px solid rgba(200, 200, 220, 0.15)',
            background: '#ffffff',
            padding: '2rem',
            ['--glow-color' as string]: CARD_GLOW_COLOR,
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 relative z-10"
            style={{ background: mode.bg }}
          >
            <mode.icon className="w-6 h-6" style={{ color: mode.color }} />
          </div>
          <div className="flex justify-center mb-5 relative z-10">
            <ModePill mode={mode} isInView={isInView} />
          </div>
          <div className="mt-2 pt-4 border-t relative z-10" style={{ borderColor: mode.border }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold px-2 py-1" style={{ background: mode.bg, color: mode.color, borderRadius: 6 }}>
                {mode.hotkey}
              </span>
              <span className="text-xs text-[#2e2d2d]/35">to activate</span>
            </div>
          </div>
        </ParticleCard>
      </div>
    </motion.div>
  );
};

// "Three modes. One key each." — exported separately for tile bg
export const ThreeModes = () => {
  return (
    <section id="features" className="py-24 md:py-36 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-center mb-4"
          >
            <span className="badge-purple">Four modes. One key each.</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-white"
          >
            More than{" "}
            <span className="font-serif-italic italic-shine"><ShinyText text="dictation." speed={4} color="#7C3AED" shineColor="#c4b5fd" /></span>
          </motion.h2>
        </div>
        <div className="space-y-24 md:space-y-32">
          {modes.map((mode, i) => (
            <ModeCard key={mode.hotkey} mode={mode} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

// Staggered row animation variant — replays on every scroll (up & down)
const rowVariant = (direction: "left" | "right", i: number) => ({
  initial: { opacity: 0, x: direction === "left" ? -20 : 20, y: 8 },
  whileInView: { opacity: 1, x: 0, y: 0 },
  viewport: { once: false, margin: "-40px" as const },
  transition: { delay: i * 0.08 + 0.15, duration: 0.5, ease: "easeOut" as const },
});

// "Built around you" — exported separately for no-tile bg
export const BuiltForYou = () => {
  return (
    <section className="py-24 md:py-36 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            className="flex justify-center mb-4"
          >
            <span className="badge-purple">Built around you</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#2e2d2d]"
          >
            Your words,{" "}
            <span className="font-serif-italic italic-shine"><ShinyText text="your shortcuts." speed={4} color="#7C3AED" shineColor="#c4b5fd" /></span>
          </motion.h2>
        </div>

        {/* ── Personal Dictionary ── */}
        <div className="flex flex-col md:flex-row items-center gap-14 mb-28">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.65 }}
            className="flex-1"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(124,58,237,0.07)] border border-[rgba(124,58,237,0.15)] mb-5">
              <BookOpen className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-xs font-semibold text-[#7C3AED]">Personal Dictionary</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-[#2e2d2d] mb-4 leading-tight">
              Teach it your vocabulary.
            </h3>
            <p className="text-[#2e2d2d]/50 leading-relaxed mb-5 max-w-sm text-base">
              Add names, brands, and technical terms. juskoe transcribes them perfectly every time.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="flex-1 w-full max-w-sm mx-auto md:mx-0"
          >
            <div className="feature-card-animated p-6 bg-[#2e2d2d]" style={{ borderColor: "rgba(124,58,237,0.2)" }}>
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div>
                  <p className="text-white font-bold text-sm">Personal Dictionary</p>
                  <p className="text-white/30 text-xs mt-0.5">5 words</p>
                </div>
              </div>
              <div className="space-y-2 relative z-10">
                {[
                  { word: "Aishwanth Kumar", type: "Name" },
                  { word: "juskoe", type: "Brand" },
                  { word: "Serendipity", type: "Word" },
                  { word: "Ephemeral", type: "Word" },
                  { word: "Eloquence", type: "Word" },
                ].map((item, i) => (
                  <motion.div
                    key={item.word}
                    {...rowVariant("left", i)}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/8 hover:border-[#7C3AED]/40 transition-colors"
                  >
                    <span className="text-white text-sm font-medium">{item.word}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}>{item.type}</span>
                  </motion.div>
                ))}
              </div>
              <div className="h-6 bg-gradient-to-t from-[#2e2d2d] to-transparent -mt-3 pointer-events-none relative z-10" />
            </div>
          </motion.div>
        </div>

        {/* ── Snippet Library ── */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-14 mb-28">
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.65 }}
            className="flex-1 md:text-right"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(124,58,237,0.07)] border border-[rgba(124,58,237,0.15)] mb-5">
              <Code className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-xs font-semibold text-[#7C3AED]">Snippet Library</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-[#2e2d2d] mb-4 leading-tight">
              Speak a cue,<br />
              paste full text.
            </h3>
            <p className="text-[#2e2d2d]/50 leading-relaxed mb-5 max-w-sm text-base md:ml-auto">
              Create voice shortcuts for repeated content. Say the cue, juskoe expands it instantly.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="flex-1 w-full max-w-sm mx-auto md:mx-0"
          >
            <div className="feature-card-animated p-6 bg-[#2e2d2d]" style={{ borderColor: "rgba(124,58,237,0.2)" }}>
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div>
                  <p className="text-white font-bold text-sm">Snippet Library</p>
                  <p className="text-white/30 text-xs mt-0.5">3 snippets</p>
                </div>
              </div>
              <div className="space-y-2 relative z-10">
                {[
                  { cue: "my email", value: "support@juskoe.in" },
                  { cue: "book a call", value: "calendly.com/juskoe/30min" },
                  { cue: "sign off", value: "Best, Aishwanth — Founder, juskoe" },
                ].map((snippet, i) => (
                  <motion.div
                    key={snippet.cue}
                    {...rowVariant("right", i)}
                    className="rounded-xl border border-white/8 hover:border-[#7C3AED]/40 transition-colors overflow-hidden"
                  >
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(124,58,237,0.25)] text-[#a78bfa] font-mono">{snippet.cue}</span>
                    </div>
                    <div className="px-4 py-2 bg-[#7C3AED]/8 border-t border-white/5">
                      <span className="text-[#a78bfa]/80 text-xs leading-snug">{snippet.value}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="h-6 bg-gradient-to-t from-[#2e2d2d] to-transparent -mt-3 pointer-events-none relative z-10" />
            </div>
          </motion.div>
        </div>

        {/* ── 100+ Languages ── */}
        <div className="flex flex-col md:flex-row items-center gap-14">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.65 }}
            className="flex-1"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(124,58,237,0.07)] border border-[rgba(124,58,237,0.15)] mb-5">
              <Globe className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-xs font-semibold text-[#7C3AED]">100+ Languages</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-[#2e2d2d] mb-4 leading-tight">
              Speak in any language.
            </h3>
            <p className="text-[#2e2d2d]/50 leading-relaxed mb-5 max-w-sm text-base">
              juskoe supports 100+ languages out of the box. Switch between them seamlessly — no setup needed.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="flex-1 w-full max-w-sm mx-auto md:mx-0"
          >
            <div className="feature-card-animated p-6 bg-[#2e2d2d]" style={{ borderColor: "rgba(124,58,237,0.2)" }}>
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div>
                  <p className="text-white font-bold text-sm">Language Support</p>
                  <p className="text-white/30 text-xs mt-0.5">100+ languages</p>
                </div>
              </div>
              <div className="space-y-2 relative z-10">
                {[
                  { flag: "🇺🇸", name: "English", code: "en" },
                  { flag: "🇪🇸", name: "Spanish", code: "es" },
                  { flag: "🇫🇷", name: "French", code: "fr" },
                  { flag: "🇩🇪", name: "German", code: "de" },
                  { flag: "🇯🇵", name: "Japanese", code: "ja" },
                  { flag: "🇰🇷", name: "Korean", code: "ko" },
                  { flag: "🇮🇳", name: "Hindi", code: "hi" },
                  { flag: "🇨🇳", name: "Chinese", code: "zh" },
                ].map((lang, i) => (
                  <motion.div
                    key={lang.code}
                    {...rowVariant("left", i)}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/8 hover:border-[#7C3AED]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-white text-sm font-medium">{lang.name}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold font-mono" style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}>{lang.code}</span>
                  </motion.div>
                ))}
              </div>
              <div className="h-6 bg-gradient-to-t from-[#2e2d2d] to-transparent -mt-3 pointer-events-none relative z-10" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Features = () => (
  <>
    <ThreeModes />
    <BuiltForYou />
  </>
);

export default Features;

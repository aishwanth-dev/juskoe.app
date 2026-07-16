import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mic, Check, ArrowRight, MessageSquare, FileText, Send } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

const steps = [
  {
    step: 1,
    title: "Press F8 anywhere",
    desc: "Open any text field and press F8. The overlay appears — Juskoe is ready to clean up your speech.",
  },
  {
    step: 2,
    title: "Speak naturally",
    desc: "Don't worry about grammar or filler words. Say it like you would to a friend: 'umm hey how r u i wanted to ask about the uh meeting tomorrow'.",
  },
  {
    step: 3,
    title: "AI fixes grammar & fillers",
    desc: "Juskoe's Grammar Mode strips out filler words ('umm', 'uhh', 'like'), fixes spelling, corrects punctuation, and adds proper capitalization.",
  },
  {
    step: 4,
    title: "Clean text appears at cursor",
    desc: "The polished version is pasted instantly. 'umm hey how r u' becomes 'Hey, how are you?' — ready to send.",
  },
];

const useCases = [
  { icon: MessageSquare, title: "Clean up messages", desc: "Speak naturally in chat, get clean professional messages without the 'umms' and 'uhhs'." },
  { icon: FileText, title: "Fix notes & drafts", desc: "Dictate rough notes and get grammatically correct text without any manual editing." },
  { icon: Send, title: "Quick replies", desc: "Reply to emails and messages by speaking — Grammar Mode cleans up your raw speech instantly." },
];

const GrammarMode = () => (
  <div className="min-h-screen" style={{ backgroundColor: "#faf9ff" }}>
    <Navbar />

    {/* Hero */}
    <section style={{ paddingTop: 140, paddingBottom: 80, background: "linear-gradient(180deg, #ede9fe 0%, #faf9ff 100%)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
        <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="badge-purple" style={{ marginBottom: 20, display: "inline-flex" }}>
          <Mic style={{ width: 12, height: 12, marginRight: 6 }} /> Grammar Mode
        </motion.span>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, marginTop: 16, color: "#2e2d2d" }}>
          Speak raw.<br />Get polished text.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ fontSize: 18, color: "rgba(46,45,45,0.6)", marginTop: 20, lineHeight: 1.7, maxWidth: 600, margin: "20px auto 0" }}>
          Press <strong style={{ color: "#059669" }}>F8</strong>, speak naturally with all your filler words, and Juskoe instantly corrects spelling, grammar, and punctuation.
        </motion.p>
      </div>
    </section>

    {/* Steps */}
    <section style={{ padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
      <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
        style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 48, color: "#2e2d2d" }}>
        How to use Grammar Mode
      </motion.h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {steps.map((s, i) => (
          <motion.div key={s.step} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
            style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: "#059669", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, flexShrink: 0, marginTop: 2
            }}>
              {s.step}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#2e2d2d" }}>{s.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "#555" }}>{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>

    {/* Example */}
    <section style={{ padding: "60px 24px", backgroundColor: "#f5f3ff" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          style={{ padding: 32, borderRadius: 16, backgroundColor: "#fff", border: "1px solid rgba(5,150,105,0.15)", boxShadow: "0 4px 20px rgba(5,150,105,0.08)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#2e2d2d", textAlign: "center" }}>See it in action</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca" }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#dc2626", marginBottom: 6 }}>You speak</p>
              <p style={{ fontSize: 16, color: "#991b1b", fontStyle: "italic" }}>"umm hey how r u i wanted to umm ask about the uh meeting tomorrow at 3pm"</p>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ArrowRight style={{ width: 20, height: 20, color: "#059669" }} />
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#16a34a", marginBottom: 6 }}>Juskoe pastes</p>
              <p style={{ fontSize: 16, color: "#166534" }}>"Hey, how are you? I wanted to ask about the meeting tomorrow at 3 PM."</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    {/* Use Cases */}
    <section style={{ padding: "80px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 48, color: "#2e2d2d" }}>
          When to use Grammar Mode
        </motion.h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
          {useCases.map((uc, i) => (
            <motion.div key={uc.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
              style={{ padding: 28, borderRadius: 16, backgroundColor: "#fff", border: "1px solid rgba(5,150,105,0.1)", boxShadow: "0 2px 12px rgba(5,150,105,0.06)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(5,150,105,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <uc.icon style={{ width: 20, height: 20, color: "#059669" }} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: "#2e2d2d" }}>{uc.title}</h3>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>{uc.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Hotkey Reminder */}
    <section style={{ padding: "60px 24px", textAlign: "center" }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
        style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "16px 28px", borderRadius: 16, background: "#fff", border: "1px solid rgba(5,150,105,0.15)", boxShadow: "0 4px 20px rgba(5,150,105,0.08)" }}>
        <span style={{ fontSize: 14, color: "#555" }}>Hotkey:</span>
        <span style={{ padding: "6px 14px", borderRadius: 8, background: "#2e2d2d", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>F8</span>
        <ArrowRight style={{ width: 16, height: 16, color: "#059669" }} />
        <span style={{ fontSize: 14, color: "#555" }}>Speak naturally</span>
        <ArrowRight style={{ width: 16, height: 16, color: "#059669" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#059669" }}>Clean text pasted</span>
      </motion.div>
    </section>

    <Footer />
  </div>
);

export default GrammarMode;

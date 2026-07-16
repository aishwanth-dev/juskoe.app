import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Wand2, ArrowRight, Edit3, Languages, FileEdit } from "lucide-react";

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
    title: "Select text in any app",
    desc: "Highlight the text you want to transform — a sentence in an email, a paragraph in a doc, or a block of code in your editor.",
  },
  {
    step: 2,
    title: "Press F7",
    desc: "With text selected, press F7. Juskoe detects the selection and enters Rewrite mode — ready for your instructions.",
  },
  {
    step: 3,
    title: "Tell it how to transform",
    desc: "Speak your instruction: 'make this more professional', 'summarize this into 3 bullet points', or 'translate this to Spanish'.",
  },
  {
    step: 4,
    title: "Rewritten text replaces selection",
    desc: "The original text is replaced with the transformed version. No copying, no pasting — just select, speak, and it's done.",
  },
];

const useCases = [
  { icon: Edit3, title: "Change tone & style", desc: "Make text professional, casual, formal, or friendly. Just select and tell Juskoe the tone you want." },
  { icon: Languages, title: "Translate instantly", desc: "Select text in any language, press F7, and say 'translate to French' or any of 99 supported languages." },
  { icon: FileEdit, title: "Summarize & expand", desc: "Condense long paragraphs into key points or expand brief notes into full documents — all by voice." },
];

const RewriteMode = () => (
  <div className="min-h-screen" style={{ backgroundColor: "#faf9ff" }}>
    <Navbar />

    {/* Hero */}
    <section style={{ paddingTop: 140, paddingBottom: 80, background: "linear-gradient(180deg, #ede9fe 0%, #faf9ff 100%)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
        <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="badge-purple" style={{ marginBottom: 20, display: "inline-flex" }}>
          <Wand2 style={{ width: 12, height: 12, marginRight: 6 }} /> Rewrite Mode
        </motion.span>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, marginTop: 16, color: "#2e2d2d" }}>
          Select any text.<br />Transform it with your voice.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ fontSize: 18, color: "rgba(46,45,45,0.6)", marginTop: 20, lineHeight: 1.7, maxWidth: 600, margin: "20px auto 0" }}>
          Highlight any text, press <strong style={{ color: "#3B82F6" }}>Select + F7</strong>, and tell Juskoe how to transform it — rewrite, summarize, translate, or change the tone.
        </motion.p>
      </div>
    </section>

    {/* Steps */}
    <section style={{ padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
      <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
        style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 48, color: "#2e2d2d" }}>
        How to use Rewrite Mode
      </motion.h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {steps.map((s, i) => (
          <motion.div key={s.step} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
            style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: "#3B82F6", color: "#fff",
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
          style={{ padding: 32, borderRadius: 16, backgroundColor: "#fff", border: "1px solid rgba(59,130,246,0.15)", boxShadow: "0 4px 20px rgba(59,130,246,0.08)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#2e2d2d", textAlign: "center" }}>See it in action</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#2563eb", marginBottom: 6 }}>1. Select text</p>
              <p style={{ fontSize: 16, color: "#1e40af" }}>"The product is good and works well. We should consider marketing it more."</p>
            </div>
            <div style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(59,130,246,0.08)", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6" }}>Press F7 and say:</span>
              <span style={{ fontSize: 13, fontStyle: "italic", color: "#555" }}>"make this sound professional for investors"</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ArrowRight style={{ width: 20, height: 20, color: "#3B82F6" }} />
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#16a34a", marginBottom: 6 }}>Rewrite pasted</p>
              <p style={{ fontSize: 16, color: "#166534" }}>"Our product delivers strong performance and reliability. We recommend increasing our marketing efforts to expand market reach."</p>
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
          What you can do with Rewrite Mode
        </motion.h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
          {useCases.map((uc, i) => (
            <motion.div key={uc.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
              style={{ padding: 28, borderRadius: 16, backgroundColor: "#fff", border: "1px solid rgba(59,130,246,0.1)", boxShadow: "0 2px 12px rgba(59,130,246,0.06)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <uc.icon style={{ width: 20, height: 20, color: "#3B82F6" }} />
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
        style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "16px 28px", borderRadius: 16, background: "#fff", border: "1px solid rgba(59,130,246,0.15)", boxShadow: "0 4px 20px rgba(59,130,246,0.08)" }}>
        <span style={{ fontSize: 14, color: "#555" }}>Flow:</span>
        <span style={{ padding: "6px 14px", borderRadius: 8, background: "#2e2d2d", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>Select text</span>
        <ArrowRight style={{ width: 16, height: 16, color: "#3B82F6" }} />
        <span style={{ padding: "6px 14px", borderRadius: 8, background: "#2e2d2d", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>F7</span>
        <ArrowRight style={{ width: 16, height: 16, color: "#3B82F6" }} />
        <span style={{ fontSize: 14, color: "#555" }}>Speak instruction</span>
        <ArrowRight style={{ width: 16, height: 16, color: "#3B82F6" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#3B82F6" }}>Text transformed</span>
      </motion.div>
    </section>

    <Footer />
  </div>
);

export default RewriteMode;

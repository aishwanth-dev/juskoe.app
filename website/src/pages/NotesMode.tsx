import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText, ArrowRight, BookOpen, ListTodo, StickyNote } from "lucide-react";

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
    title: "Press F9 anywhere",
    desc: "Press F9 in any app. Juskoe opens the Notes overlay — ready to capture your thoughts without needing to type or switch windows.",
  },
  {
    step: 2,
    title: "Speak your thoughts",
    desc: "Say whatever comes to mind. Ideas, reminders, meeting notes, to-do lists — just talk naturally and Juskoe transcribes it in real time.",
  },
  {
    step: 3,
    title: "AI formats your note",
    desc: "Your spoken words are cleaned up and formatted into readable notes. Bullet points, paragraphs, and structure are applied automatically.",
  },
  {
    step: 4,
    title: "Note is saved locally",
    desc: "The note is saved to your local Juskoe Notes library. Pro users get cloud sync so notes are available across all your devices.",
  },
];

const useCases = [
  { icon: StickyNote, title: "Quick capture", desc: "Capture ideas, reminders, and thoughts instantly without breaking your workflow." },
  { icon: ListTodo, title: "To-do lists", desc: "Speak your tasks and get organized lists. 'Buy groceries, call the plumber, finish the report.'" },
  { icon: BookOpen, title: "Meeting notes", desc: "Dictate meeting notes in real time. Juskoe formats them cleanly so you never miss a detail." },
];

const NotesMode = () => (
  <div className="min-h-screen" style={{ backgroundColor: "#faf9ff" }}>
    <Navbar />

    {/* Hero */}
    <section style={{ paddingTop: 140, paddingBottom: 80, background: "linear-gradient(180deg, #ede9fe 0%, #faf9ff 100%)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
        <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="badge-purple" style={{ marginBottom: 20, display: "inline-flex" }}>
          <FileText style={{ width: 12, height: 12, marginRight: 6 }} /> Notes Mode
        </motion.span>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, marginTop: 16, color: "#2e2d2d" }}>
          Speak a thought.<br />Keep it forever.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ fontSize: 18, color: "rgba(46,45,45,0.6)", marginTop: 20, lineHeight: 1.7, maxWidth: 600, margin: "20px auto 0" }}>
          Press <strong style={{ color: "#D97706" }}>F9</strong> to capture voice notes that are automatically saved — no typing, no app switching, no lost ideas.
        </motion.p>
      </div>
    </section>

    {/* Steps */}
    <section style={{ padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
      <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
        style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 48, color: "#2e2d2d" }}>
        How to use Notes Mode
      </motion.h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {steps.map((s, i) => (
          <motion.div key={s.step} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
            style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: "#D97706", color: "#fff",
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

    {/* Use Cases */}
    <section style={{ padding: "80px 24px", backgroundColor: "#f5f3ff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 48, color: "#2e2d2d" }}>
          When to use Notes Mode
        </motion.h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
          {useCases.map((uc, i) => (
            <motion.div key={uc.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
              style={{ padding: 28, borderRadius: 16, backgroundColor: "#fff", border: "1px solid rgba(217,119,6,0.1)", boxShadow: "0 2px 12px rgba(217,119,6,0.06)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(217,119,6,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <uc.icon style={{ width: 20, height: 20, color: "#D97706" }} />
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
        style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "16px 28px", borderRadius: 16, background: "#fff", border: "1px solid rgba(217,119,6,0.15)", boxShadow: "0 4px 20px rgba(217,119,6,0.08)" }}>
        <span style={{ fontSize: 14, color: "#555" }}>Hotkey:</span>
        <span style={{ padding: "6px 14px", borderRadius: 8, background: "#2e2d2d", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>F9</span>
        <ArrowRight style={{ width: 16, height: 16, color: "#D97706" }} />
        <span style={{ fontSize: 14, color: "#555" }}>Speak your thought</span>
        <ArrowRight style={{ width: 16, height: 16, color: "#D97706" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#D97706" }}>Note saved</span>
      </motion.div>
    </section>

    <Footer />
  </div>
);

export default NotesMode;

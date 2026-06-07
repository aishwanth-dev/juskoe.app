import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mic, Zap, Globe, Heart, Linkedin, Mail } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

const values = [
  {
    icon: Zap,
    title: "Speed & Simplicity",
    desc: "No bloat, no complex setup. Press a hotkey, speak, and your text appears exactly where you need it.",
  },
  {
    icon: Globe,
    title: "Works Everywhere",
    desc: "System-wide integration. Gmail, VS Code, Slack, Word - any text field in any application on Windows or macOS.",
  },
  {
    icon: Heart,
    title: "Built With Passion",
    desc: "Juskoe was built by two developers who were tired of typing. Every feature exists because it was needed.",
  },
];

const founders = [
  {
    name: "Aishwanth M S",
    role: "Co-Founder & Developer",
    email: "aishwanth@juskoe.in",
    linkedin: "https://www.linkedin.com/in/aishwanth/",
    bio: "Aishwanth is a full-stack developer and AI enthusiast who built Juskoe from the ground up. He designed the app to solve his own productivity challenges - and ended up building a tool that thousands of people now rely on every day.",
  },
  {
    name: "Srinivasan V",
    role: "Co-Founder",
    email: "srinivasan@juskoe.in",
    linkedin: "https://www.linkedin.com/in/srinivasan-v-014b20363/",
    bio: "Srinivasan brings strategic vision and product thinking to Juskoe. His focus on user experience and growth ensures that every feature we ship genuinely improves how people work and communicate.",
  },
];

const About = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf9ff" }}>
      <Navbar />

      {/* Hero */}
      <section
        style={{
          paddingTop: 140,
          paddingBottom: 80,
          background: "linear-gradient(180deg, #ede9fe 0%, #faf9ff 100%)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="badge-purple"
            style={{ marginBottom: 20, display: "inline-flex" }}
          >
            About Us
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginTop: 16,
              color: "#2e2d2d",
            }}
          >
            We're building the voice layer for every app
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              fontSize: 18,
              color: "rgba(46,45,45,0.6)",
              marginTop: 20,
              lineHeight: 1.7,
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Juskoe is developed by <strong style={{ color: "#2e2d2d" }}>16xStudios</strong>, a
            product studio focused on building AI-powered tools that make everyday computing faster
            and more natural.
          </motion.p>
        </div>
      </section>

      {/* Story Section */}
      <section style={{ padding: "80px 24px", maxWidth: 800, margin: "0 auto" }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20, color: "#2e2d2d" }}>Our Story</h2>
          <div
            style={{
              fontSize: 16,
              lineHeight: 1.8,
              color: "#444",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <p>
              Juskoe was born out of frustration. As developers and content creators, we spend
              hours typing every day - emails, code comments, messages, documents. We thought:
              <em> why are we still typing when we can speak 3x faster?</em>
            </p>
            <p>
              Existing voice-to-text tools were either too expensive ($15+/month), didn't work
              system-wide, or lacked the intelligence to format text properly. So we built Juskoe —
              a universal voice layer that works in <strong>any</strong> app, understands context,
              and intelligently formats your text based on what you're doing.
            </p>
            <p>
              Today, Juskoe supports 99 languages, three distinct modes (AI, Grammar, Notes),
              custom dictionaries, text snippets, writing styles, and cloud sync - all in a
              lightweight desktop app that sits quietly in your system tray until you need it.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Values Grid */}
      <section
        style={{
          padding: "80px 24px",
          backgroundColor: "#f5f3ff",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 48, color: "#2e2d2d" }}
          >
            What We Believe
          </motion.h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 24,
            }}
          >
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                style={{
                  padding: 32,
                  borderRadius: 16,
                  backgroundColor: "#fff",
                  border: "1px solid rgba(124,58,237,0.1)",
                  boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: "rgba(124,58,237,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <v.icon style={{ width: 22, height: 22, color: "#7C3AED" }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#2e2d2d" }}>{v.title}</h3>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>
                  {v.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Co-Founders Section */}
      <section style={{ padding: "80px 24px", maxWidth: 900, margin: "0 auto" }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: "center", color: "#2e2d2d" }}>
            Meet the Founders
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
            }}
          >
            {founders.map((f, i) => (
              <motion.div
                key={f.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                style={{
                  padding: 32,
                  borderRadius: 16,
                  backgroundColor: "#fff",
                  border: "1px solid rgba(124,58,237,0.1)",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.08)",
                }}
              >
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#2e2d2d" }}>{f.name}</h3>
                <p style={{ fontSize: 14, color: "#7C3AED", fontWeight: 600, marginBottom: 16 }}>
                  {f.role} - 16xStudios
                </p>
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.8,
                    color: "#555",
                    marginBottom: 20,
                  }}
                >
                  {f.bio}
                </p>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <a
                    href={f.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 8,
                      backgroundColor: "rgba(124,58,237,0.08)",
                      color: "#7C3AED",
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      transition: "background 0.2s",
                    }}
                  >
                    <Linkedin style={{ width: 16, height: 16 }} />
                    LinkedIn
                  </a>
                  <a
                    href={`mailto:${f.email}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 8,
                      backgroundColor: "rgba(124,58,237,0.08)",
                      color: "#7C3AED",
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      transition: "background 0.2s",
                    }}
                  >
                    <Mail style={{ width: 16, height: 16 }} />
                    {f.email}
                  </a>
                </div>
              </motion.div>
            ))}
          </div>

          <div
            style={{
              marginTop: 32,
              textAlign: "center",
              padding: 24,
              borderRadius: 12,
              backgroundColor: "rgba(124,58,237,0.04)",
              border: "1px solid rgba(124,58,237,0.08)",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: "#2e2d2d", marginBottom: 2 }}>Phone</p>
            <p style={{ fontSize: 15, color: "#555", margin: 0 }}>+91 8608208309</p>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default About;

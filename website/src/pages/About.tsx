import { Helmet } from "react-helmet-async";
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
    desc: "System-wide integration. Gmail, VS Code, Slack, Word — any text field in any application on Windows or macOS.",
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
    role: "CEO & Founder",
    email: "aishwanth@juskoe.in",
    linkedin: "https://www.linkedin.com/in/aishwanth/",
    bio: "Aishwanth is a full-stack developer and AI entrepreneur who architected Juskoe from the ground up. As CEO, he leads product vision, engineering strategy, and the mission to make voice the universal input layer for every desktop application. He built Juskoe to solve his own productivity frustrations — and it's now relied upon by thousands of users worldwide.",
  },
  {
    name: "Vishwajeeth Rao B",
    role: "Co-Founder",
    email: "vishwajeeth@juskoe.in",
    linkedin: "https://www.linkedin.com/in/vishwajeeth-rao-b-7a1764381/",
    bio: "Vishwajeeth brings strategic product thinking and operational excellence to Juskoe. As Co-Founder, he drives user growth, partnerships, and the overall product roadmap — ensuring every feature we ship genuinely improves how people work and communicate with voice AI technology.",
  },
  {
    name: "Govind D S",
    role: "CTO",
    email: "govind@juskoe.in",
    linkedin: "https://www.linkedin.com/in/govind-ds-16280135/",
    bio: "Govind leads the technical architecture and engineering teams at Juskoe. As CTO, he oversees the AI/ML pipeline, speech-to-text inference, system-level integrations, and cloud infrastructure — ensuring Juskoe delivers blazing-fast, accurate voice recognition across Windows and macOS with enterprise-grade reliability.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://juskoe.in/#organization",
      "name": "Juskoe",
      "url": "https://juskoe.in",
      "description": "Juskoe is a universal voice AI assistant that works system-wide on Windows and macOS. Speak naturally and get polished text in any app — Gmail, VS Code, Slack, Word, and more.",
      "slogan": "Just speak, it happens",
      "foundingDate": "2025",
      "founder": [
        {
          "@type": "Person",
          "name": "Aishwanth M S",
          "jobTitle": "CEO & Founder",
          "email": "aishwanth@juskoe.in",
          "url": "https://www.linkedin.com/in/aishwanth/"
        },
        {
          "@type": "Person",
          "name": "Vishwajeeth Rao B",
          "jobTitle": "Co-Founder",
          "email": "vishwajeeth@juskoe.in",
          "url": "https://www.linkedin.com/in/vishwajeeth-rao-b-7a1764381/"
        }
      ],
      "cto": {
        "@type": "Person",
        "name": "Govind D S",
        "jobTitle": "CTO",
        "email": "govind@juskoe.in",
        "url": "https://www.linkedin.com/in/govind-ds-16280135/"
      },
      "sameAs": [
        "https://juskoe.in",
        "https://www.linkedin.com/company/juskoe"
      ],
      "logo": "https://juskoe.in/juskoe-logo.png",
      "foundingLocation": {
        "@type": "Place",
        "name": "India"
      }
    },
    {
      "@type": "WebPage",
      "@id": "https://juskoe.in/about",
      "name": "About Juskoe — Meet the Founders | AI Voice Assistant",
      "description": "Learn about Juskoe, the universal voice layer for your OS. Meet founders Aishwanth M S (CEO), Vishwajeeth Rao B (Co-Founder), and Govind D S (CTO) — the team building AI-powered voice-to-text for every desktop app.",
      "isPartOf": { "@id": "https://juskoe.in/#website" },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://juskoe.in" },
          { "@type": "ListItem", "position": 2, "name": "About", "item": "https://juskoe.in/about" }
        ]
      }
    },
    {
      "@type": "FAQPage",
      "@id": "https://juskoe.in/about#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Juskoe?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Juskoe is a universal AI-powered voice assistant that works system-wide on Windows and macOS. It lets you speak naturally and get polished, formatted text in any application — Gmail, VS Code, Slack, Word, browsers, and more."
          }
        },
        {
          "@type": "Question",
          "name": "Who founded Juskoe?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Juskoe was founded by Aishwanth M S (CEO), Vishwajeeth Rao B (Co-Founder), and Govind D S (CTO) under the product studio 16xStudios."
          }
        },
        {
          "@type": "Question",
          "name": "Is Juskoe free to use?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, Juskoe offers a free tier with powerful voice-to-text capabilities. Premium features including AI-powered formatting, custom dictionaries, snippets, and cloud sync are available for pro users."
          }
        },
        {
          "@type": "Question",
          "name": "Does Juskoe work in every application?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! Juskoe is a system-wide voice layer that works in any text field across all applications — email clients, code editors, messaging apps, document editors, browsers, and more."
          }
        },
        {
          "@type": "Question",
          "name": "What languages does Juskoe support?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Juskoe supports a wide range of languages for speech-to-text, with three distinct modes: AI Mode for intelligent formatting, Grammar Mode for clean dictation, and Notes Mode for quick capture."
          }
        }
      ]
    }
  ]
};

const About = () => {
  return (
    <>
      <Helmet>
        <title>About Juskoe — Meet the Founders | AI Voice Assistant for Windows & macOS</title>
        <meta name="description" content="Learn about Juskoe, the universal voice layer for your operating system. Meet the founders — Aishwanth M S (CEO), Vishwajeeth Rao B (Co-Founder), and Govind D S (CTO). Discover how we're making voice-to-text work in every app, everywhere." />
        <meta name="keywords" content="Juskoe, voice assistant, AI voice typing, speech to text, voice to text desktop app, system-wide dictation, Juskoe founders, Aishwanth, Vishwajeeth, Govind, 16xStudios, voice AI, desktop voice assistant, Windows voice typing, macOS dictation" />
        <meta name="author" content="Juskoe — 16xStudios" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />

        {/* Open Graph */}
        <meta property="og:title" content="About Juskoe — Meet the Founders | AI Voice Assistant" />
        <meta property="og:description" content="Juskoe is a universal voice layer for your OS. Speak naturally, get polished text anywhere. Meet the team behind it — Aishwanth, Vishwajeeth, and Govind." />
        <meta property="og:url" content="https://juskoe.in/about" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Juskoe" />
        <meta property="og:image" content="https://juskoe.in/juskoe-logo.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About Juskoe — Meet the Founders | AI Voice Assistant" />
        <meta name="twitter:description" content="Juskoe puts voice AI in every app. Meet the founders building the universal voice layer for your desktop." />
        <meta name="twitter:image" content="https://juskoe.in/juskoe-logo.png" />

        {/* Canonical */}
        <link rel="canonical" href="https://juskoe.in/about" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      </Helmet>

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
                hours typing every day — emails, code comments, messages, documents. We thought:
                <em> why are we still typing when we can speak 3x faster?</em>
              </p>
              <p>
                Existing voice-to-text tools were either too expensive ($15+/month), didn't work
                system-wide, or lacked the intelligence to format text properly. So we built Juskoe —
                a universal voice layer that works in <strong>any</strong> app, understands context,
                and intelligently formats your text based on what you're doing.
              </p>
              <p>
                Today, Juskoe supports a wide range of languages, three distinct modes (AI, Grammar, Notes),
                custom dictionaries, text snippets, writing styles, and cloud sync — all in a
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

        {/* Meet the Founders Section */}
        <section style={{ padding: "80px 24px", maxWidth: 960, margin: "0 auto" }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, textAlign: "center", color: "#2e2d2d" }}>
              Meet the Founders
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "#666",
                textAlign: "center",
                marginBottom: 40,
                maxWidth: 560,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              We're a small, passionate team on a mission to make voice the fastest way to get text into any app.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
                    {f.role} — 16xStudios
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
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <a
                      href={f.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${f.name} on LinkedIn`}
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
                      aria-label={`Email ${f.name}`}
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
    </>
  );
};

export default About;

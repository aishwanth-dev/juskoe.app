import { motion } from "framer-motion";
import { useState } from "react";
import logo from "@/assets/juskoe-logo.png";
import { Twitter, Mail } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "Changelog", href: "#" },
  ],
  Modes: [
    { label: "AI Mode (F7)", href: "#features" },
    { label: "Grammar Mode (F8)", href: "#features" },
    { label: "Notes Mode (F9)", href: "#features" },
  ],

  Company: [
    { label: "About", href: "/about" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact", href: "/contact" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Mail, href: "mailto:support@juskoe.in", label: "Email" },
];

/* Letter-by-letter hover glow — NO shine animation */
const GlowLetter = ({ char }: { char: string }) => {
  const [hovered, setHovered] = useState(false);
  const isKoe = "koe.".includes(char);

  return (
    <motion.span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{
        textShadow: hovered
          ? "0 0 20px rgba(124,58,237,0.8), 0 0 40px rgba(124,58,237,0.4), 0 0 60px rgba(124,58,237,0.2)"
          : "0 0 0px transparent",
        color: hovered ? "#7C3AED" : "#2e2d2d",
      }}
      transition={{ duration: 0.25 }}
      style={{
        fontFamily: isKoe
          ? "'Times New Roman', Times, Georgia, serif"
          : "Inter, sans-serif",
        fontStyle: isKoe ? "italic" : "normal",
        fontWeight: isKoe ? 700 : 800,
        cursor: "default",
        display: "inline-block",
      }}
    >
      {char}
    </motion.span>
  );
};

const Footer = () => {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(124,58,237,0.1)",
        padding: "64px 24px",
        backgroundColor: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "32px 40px",
            marginBottom: 48,
          }}
        >
          {/* Brand column */}
          <div style={{ gridColumn: "span 2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <img src={logo} alt="Juskoe" style={{ height: 28, width: 28 }} />
              <span style={{ fontSize: 22, letterSpacing: "-0.01em" }}>
                {"juskoe.".split("").map((char, i) => (
                  <GlowLetter key={i} char={char} />
                ))}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "rgba(46,45,45,0.5)", maxWidth: 260, lineHeight: 1.6, margin: "0 0 4px" }}>
              A universal voice layer for every app.
            </p>
            <p style={{ fontSize: 12, color: "rgba(46,45,45,0.35)", margin: "0 0 24px" }}>
              Windows & macOS
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <motion.a
                href="https://firebasestorage.googleapis.com/v0/b/juskoe-7698d.firebasestorage.app/o/Juskoe%20Setup%201.0.0.exe?alt=media&token=28f7ccbe-c1e6-4996-9e13-45700324f5f3"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  backgroundColor: "#2e2d2d",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" /></svg>
                Windows
              </motion.a>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  border: "1px solid rgba(46,45,45,0.15)",
                  color: "rgba(46,45,45,0.35)",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: "default",
                }}
              >
                <svg style={{ width: 14, height: 14, opacity: 0.4 }} viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                Mac — Soon
              </span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "#2e2d2d", marginBottom: 16, marginTop: 0 }}>
                {category}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map((link) => (
                  <li key={link.label}>
                    <motion.a
                      href={link.href}
                      whileHover={{
                        color: "#7C3AED",
                        textShadow: "0 0 12px rgba(124,58,237,0.3)",
                      }}
                      style={{
                        fontSize: 12,
                        color: "rgba(46,45,45,0.5)",
                        textDecoration: "none",
                        transition: "color 0.2s",
                      }}
                    >
                      {link.label}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(124,58,237,0.08)",
            paddingTop: 32,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <p style={{ fontSize: 12, color: "rgba(46,45,45,0.35)", margin: 0 }}>
            © {new Date().getFullYear()} Juskoe. All rights reserved.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {socialLinks.map((social) => (
              <motion.a
                key={social.label}
                href={social.href}
                whileHover={{ color: "#7C3AED", scale: 1.15 }}
                style={{ color: "rgba(46,45,45,0.3)", textDecoration: "none" }}
                aria-label={social.label}
              >
                <social.icon style={{ width: 16, height: 16 }} />
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

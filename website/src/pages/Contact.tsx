import { motion } from "framer-motion";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, Phone, MapPin, Send, Twitter, Linkedin } from "lucide-react";

const contactInfo = [
  {
    icon: Mail,
    label: "Email",
    value: "support@juskoe.in",
    href: "mailto:support@juskoe.in",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+91 8608208309",
    href: "tel:+918608208309",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Tamil Nadu, India",
    href: null,
  },
];

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailto = `mailto:support@juskoe.in?subject=${encodeURIComponent(
      formData.subject || "Juskoe Inquiry"
    )}&body=${encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\n${formData.message}`
    )}`;
    window.open(mailto, "_blank");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid rgba(124,58,237,0.15)",
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#2e2d2d",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf9ff" }}>
      <Navbar />

      <section
        style={{
          paddingTop: 140,
          paddingBottom: 60,
          background: "linear-gradient(180deg, #ede9fe 0%, #faf9ff 100%)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="badge-purple"
            style={{ marginBottom: 20, display: "inline-flex" }}
          >
            Get in Touch
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16, color: "#2e2d2d" }}
          >
            Contact Us
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              fontSize: 17,
              color: "#666",
              marginTop: 14,
              maxWidth: 500,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Have a question, feedback, or partnership inquiry? We'd love to hear from you.
          </motion.p>
        </div>
      </section>

      <section style={{ padding: "40px 24px 80px", maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.3fr",
            gap: 40,
          }}
        >
          {/* Left — Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#2e2d2d" }}>
              Let's talk
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "#666",
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              Reach out via email, phone, or the contact form. We typically respond within 24
              hours.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {contactInfo.map((info) => (
                <div key={info.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: "rgba(124,58,237,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <info.icon style={{ width: 20, height: 20, color: "#7C3AED" }} />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#999",
                        marginBottom: 2,
                        fontWeight: 500,
                      }}
                    >
                      {info.label}
                    </p>
                    {info.href ? (
                      <a
                        href={info.href}
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#2e2d2d",
                          textDecoration: "none",
                        }}
                      >
                        {info.value}
                      </a>
                    ) : (
                      <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#2e2d2d" }}>{info.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 40 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#999", marginBottom: 12 }}>
                Follow Us
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { icon: Twitter, href: "#", label: "Twitter" },
                  { icon: Linkedin, href: "https://www.linkedin.com/in/aishwanth/", label: "LinkedIn" },
                  { icon: Mail, href: "mailto:support@juskoe.in", label: "Email" },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: "rgba(124,58,237,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#7C3AED",
                      textDecoration: "none",
                      transition: "background 0.2s",
                    }}
                  >
                    <s.icon style={{ width: 18, height: 18 }} />
                  </a>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 32,
                padding: 20,
                borderRadius: 12,
                backgroundColor: "rgba(124,58,237,0.05)",
                border: "1px solid rgba(124,58,237,0.1)",
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: "#2e2d2d" }}>16xStudios</p>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, margin: 0 }}>
                Building AI-powered productivity tools
              </p>
            </div>
          </motion.div>

          {/* Right — Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <form
              onSubmit={handleSubmit}
              style={{
                padding: 32,
                borderRadius: 20,
                backgroundColor: "#fff",
                border: "1px solid rgba(124,58,237,0.1)",
                boxShadow: "0 4px 24px rgba(124,58,237,0.08)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#2e2d2d", marginBottom: 6, display: "block" }}>
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={inputStyle}
                    placeholder="Your name"
                    onFocus={(e) => { e.target.style.borderColor = "#7C3AED"; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(124,58,237,0.15)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#2e2d2d", marginBottom: 6, display: "block" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={inputStyle}
                    placeholder="your@email.com"
                    onFocus={(e) => { e.target.style.borderColor = "#7C3AED"; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(124,58,237,0.15)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#2e2d2d", marginBottom: 6, display: "block" }}>
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  style={inputStyle}
                  placeholder="What's this about?"
                  onFocus={(e) => { e.target.style.borderColor = "#7C3AED"; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(124,58,237,0.15)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#2e2d2d", marginBottom: 6, display: "block" }}>
                  Message
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Tell us more..."
                  onFocus={(e) => { e.target.style.borderColor = "#7C3AED"; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(124,58,237,0.15)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  borderRadius: 12,
                  backgroundColor: submitted ? "#22c55e" : "#7C3AED",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background-color 0.3s",
                }}
              >
                {submitted ? (
                  "✓ Opening email client..."
                ) : (
                  <>
                    <Send style={{ width: 16, height: 16 }} />
                    Send Message
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;

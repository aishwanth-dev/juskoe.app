import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Terms = () => {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: `By downloading, installing, or using Juskoe ("the Software"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Software.

These Terms constitute a legally binding agreement between you and 16xStudios ("Company", "we", "us") regarding your use of the Juskoe application.`,
    },
    {
      title: "2. Description of Service",
      content: `Juskoe is a desktop voice-to-text application that:

• Converts speech to text with AI-powered accuracy
• Provides intelligent text formatting and context-aware output
• Offers grammar correction, note-taking, and text snippet management
• Works system-wide across all applications on Windows and macOS
• Supports 99 languages for speech recognition`,
    },
    {
      title: "3. Free and Pro Plans",
      content: `Free Plan:
• Includes daily usage limits for AI Mode and Grammar Mode
• Core features: speech-to-text, dictionary, snippets, notes
• No cloud sync

Pro Plan:
• Unlimited AI and Grammar mode usage
• Cloud sync for dictionary, snippets, notes, and settings
• Priority support
• Custom writing styles and output languages

Pro subscriptions are billed monthly. You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. No refunds are provided for partial billing periods.`,
    },
    {
      title: "4. User Conduct",
      content: `You agree NOT to use Juskoe to:

• Generate harmful, abusive, or illegal content
• Attempt to reverse-engineer, decompile, or modify the Software
• Circumvent usage limits or payment mechanisms
• Distribute or resell the Software without authorization
• Use the Software for any purpose that violates applicable laws

We reserve the right to terminate accounts that violate these terms.`,
    },
    {
      title: "5. Intellectual Property",
      content: `The Juskoe application, including its design, code, branding, and documentation, is the intellectual property of 16xStudios. All rights are reserved.

You are granted a non-exclusive, non-transferable license to use the Software for personal or commercial productivity purposes. This license does not transfer any ownership rights.`,
    },
    {
      title: "6. Privacy & Data",
      content: `Your use of Juskoe is also governed by our Privacy Policy. Key points:

• Voice data is processed securely and not permanently stored
• Account and sync data is stored with enterprise-grade encryption
• You can delete your data at any time

For full details, please review our Privacy Policy.`,
    },
    {
      title: "7. Disclaimers",
      content: `THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE:

• Uninterrupted or error-free operation
• Accuracy of speech-to-text transcription
• Accuracy of AI-generated content
• Compatibility with all applications or operating systems

You are solely responsible for reviewing AI-generated output before use. Juskoe is a productivity tool - not a replacement for professional editing, legal, or medical advice.`,
    },
    {
      title: "8. Limitation of Liability",
      content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, 16xStudios SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SOFTWARE.

Our total liability shall not exceed the amount you paid for the Software in the 12 months preceding the claim.`,
    },
    {
      title: "9. Modifications to Terms",
      content: `We reserve the right to modify these Terms at any time. Changes will be communicated through the application or our website. Continued use of the Software after changes constitutes acceptance of the updated Terms.`,
    },
    {
      title: "10. Governing Law",
      content: `These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms shall be resolved in the courts of Tamil Nadu, India.`,
    },
    {
      title: "11. Contact",
      content: `For questions about these Terms, contact us:

• Email: support@juskoe.in
• Phone: +91 8608208309
• Company: 16xStudios`,
    },
  ];

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
            Legal
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16, color: "#2e2d2d" }}
          >
            Terms of Service
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ fontSize: 14, color: "rgba(46,45,45,0.5)", marginTop: 12 }}
          >
            Last updated: March 14, 2025
          </motion.p>
        </div>
      </section>

      <section style={{ padding: "40px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.8,
            color: "#444",
            marginBottom: 40,
          }}
        >
          Please read these Terms of Service carefully before using the Juskoe application
          developed by 16xStudios.
        </p>

        {sections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 * i }}
            style={{ marginBottom: 36 }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 12,
                color: "#2e2d2d",
              }}
            >
              {section.title}
            </h2>
            <div
              style={{
                fontSize: 15,
                lineHeight: 1.8,
                color: "#555",
                whiteSpace: "pre-line",
              }}
            >
              {section.content}
            </div>
          </motion.div>
        ))}
      </section>

      <Footer />
    </div>
  );
};

export default Terms;

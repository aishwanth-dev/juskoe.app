import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Privacy = () => {
  const sections = [
    {
      title: "1. Information We Collect",
      content: `When you use Juskoe, we collect minimal information necessary to provide our service:

• Account Information - If you create an account, we collect your email address and display name for authentication purposes.

• Voice Data - Your voice recordings are processed securely. We do not store, share, or sell your audio recordings.

• AI Processing - When using AI features, your transcribed text is processed to format and enhance your content. This text is not permanently stored after processing.

• Usage Metrics - We track anonymous usage counts to manage plan limits. No personal content is logged.

• Cloud Sync Data (Pro) - If you opt into cloud sync, your custom dictionary, snippets, notes, and settings are encrypted and stored securely.`,
    },
    {
      title: "2. How We Use Your Information",
      content: `We use the collected information to:

• Provide and maintain the Juskoe application
• Process your voice input into formatted text
• Apply AI formatting and grammar corrections
• Sync your data across devices (Pro users)
• Enforce usage limits on free plans
• Send important service updates (only if you've opted in)
• Improve the quality and performance of our service`,
    },
    {
      title: "3. Privacy & Security",
      content: `Juskoe is designed with privacy as a core principle:

• Voice processing is handled securely with industry-standard practices.
• Audio files are temporary and deleted immediately after processing.
• No voice recordings are stored, logged, or shared with third parties.
• The application is designed to minimize data collection while maximizing functionality.`,
    },
    {
      title: "4. Third-Party Services",
      content: `Juskoe integrates with trusted third-party services for specific functionality:

• AI Services - Text processing is handled by enterprise-grade AI providers with strict privacy policies.
• Authentication - Secure sign-in via industry-standard OAuth providers.
• Payments - Payment processing is handled by certified payment gateways. We do not store payment card details.

All third-party partners are vetted for security compliance.`,
    },
    {
      title: "5. Data Storage & Security",
      content: `• All local data (dictionary, snippets, notes, settings) is stored securely on your device.
• Cloud sync data is stored with enterprise-grade encryption and row-level security - each user can only access their own data.
• Authentication tokens are stored securely on your device.
• We use HTTPS for all network communications.`,
    },
    {
      title: "6. Your Rights",
      content: `You have the right to:

• Access your personal data at any time through the app
• Export your dictionary, snippets, and notes
• Delete your account and all associated data
• Opt out of cloud sync and keep all data local
• Withdraw consent for data processing at any time

To exercise these rights, contact us at support@juskoe.in.`,
    },
    {
      title: "7. Children's Privacy",
      content: `Juskoe is not intended for children under 13. We do not knowingly collect personal information from children. If you believe we have collected data from a child under 13, please contact us immediately.`,
    },
    {
      title: "8. Changes to This Policy",
      content: `We may update this privacy policy from time to time. We will notify users of significant changes via the application or email. The "Last Updated" date at the top of this page will be revised accordingly.`,
    },
    {
      title: "9. Contact Us",
      content: `If you have questions about this privacy policy, please contact us:

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
            Privacy Policy
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
          At Juskoe ("we", "our", "us"), your privacy is important to us. This Privacy Policy
          explains how we collect, use, and protect your information when you use the Juskoe
          desktop application and related services.
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

export default Privacy;

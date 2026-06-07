import { motion } from "framer-motion";
import ShinyText from "./ShinyText";
import MagicBento from "./MagicBento";
import "./MagicBento.css";

const UseCases = () => {
  return (
    <section id="use-cases" className="py-24 md:py-32 px-6" style={{ backgroundColor: "#0f0520" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-center mb-4"
          >
            <span
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase"
              style={{
                background: "rgba(124,58,237,0.18)",
                border: "1px solid rgba(124,58,237,0.35)",
                color: "#a78bfa",
              }}
            >
              Built for everyone
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white"
          >
            For anyone who{" "}
            <span className="font-serif-italic italic-shine">
              <ShinyText text="types a lot." speed={4} color="#ffffff" shineColor="#a78bfa" />
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-white/40 text-lg max-w-xl mx-auto"
          >
            If you write messages, emails, notes, or prompts every day - juskoe removes the friction completely.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <MagicBento />
        </motion.div>
      </div>
    </section>
  );
};

export default UseCases;

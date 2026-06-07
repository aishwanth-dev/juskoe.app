import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import ShinyText from "./ShinyText";
import appDashboard from "@/assets/app-dashboard.jpg";

const stats = [
  { value: "4×", label: "Faster than typing", color: "#7C3AED" },
  { value: "100+", label: "Languages", color: "#059669" },
  { value: "< 1s", label: "End-to-end latency", color: "#D97706" },
  { value: "∞", label: "Apps supported", color: "#7C3AED" },
];

const Showcase = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const textY = useTransform(scrollYProgress, [0, 1], [20, -20]);

  return (
    <section ref={sectionRef} className="py-24 md:py-36 px-6 overflow-hidden bg-grid">
      <div className="max-w-6xl mx-auto">

        {/* Top label */}
        <div className="flex justify-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="badge-purple">Your voice, transformed</span>
          </motion.div>
        </div>

        {/* Big centered headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-center mb-6"
        >
          <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight text-[#2e2d2d] leading-[1.04]">
            Its Your Voice,
            <br />
            <span className="font-serif-italic italic-shine">
              <ShinyText text="That can reshape." speed={4} color="#2e2d2d" shineColor="#7C3AED" />
            </span>
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-center text-[#2e2d2d]/50 text-lg md:text-xl max-w-2xl mx-auto mb-20 leading-relaxed"
        >
          Stop crafting every sentence by hand. Speak naturally and jus声 delivers polished, context-aware output instantly - no switching, no rewriting, no friction.
        </motion.p>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4, boxShadow: `0 16px 40px ${stat.color}18` }}
              className="p-6 rounded-2xl bg-white border border-[rgba(124,58,237,0.1)] shadow-card text-center transition-all duration-300"
            >
              <p className="text-4xl font-black mb-1" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-[#2e2d2d]/50 font-medium leading-tight">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Full-width app screenshot */}
        <motion.div
          style={{ y: imgY }}
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="relative"
        >
          {/* Purple glow */}
          <div className="absolute inset-x-0 -bottom-8 h-32 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-0 bg-[#7C3AED] rounded-3xl blur-3xl opacity-[0.07] scale-105 pointer-events-none" />

          <div
            className="relative rounded-2xl overflow-hidden border border-[rgba(124,58,237,0.15)]"
            style={{ boxShadow: "0 24px 80px rgba(124,58,237,0.14), 0 4px 20px rgba(0,0,0,0.07)" }}
          >
            <img
              src={appDashboard}
              alt="jus声 dashboard interface"
              className="w-full rounded-2xl"
            />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-[rgba(124,58,237,0.08)]" />

            {/* Floating overlay pill */}
            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2"
            >
              <div className="overlay-demo-pill">
                <span style={{ fontSize: 10, fontWeight: 800, color: "#059669", fontFamily: "Inter, sans-serif" }}>G</span>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="wave-bar-demo" style={{ background: "#059669", animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Showcase;

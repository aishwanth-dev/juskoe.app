import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import { Mic, Brain, MousePointer2 } from "lucide-react";
import ShinyText from "./ShinyText";

const steps = [
  {
    icon: Mic,
    number: "01",
    title: "Press a hotkey & speak",
    color: "#7C3AED",
    description: "Choose your mode - AI, Grammar, or Notes. Speak naturally into your mic.",
  },
  {
    icon: Brain,
    number: "02",
    title: "AI refines in milliseconds",
    color: "#059669",
    description: "Speech is transcribed locally. Only text reaches AI. Polished instantly.",
  },
  {
    icon: MousePointer2,
    number: "03",
    title: "Pasted at your cursor",
    color: "#D97706",
    description: "Clean, polished text appears exactly where your cursor is - in any app.",
  },
];

/* Scroll-activated vertical progress line */
const TimelineLine = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.7", "end 0.5"],
  });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0.6, 0.3]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 3,
      }}
    >
      {/* Track background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 99,
          background: "rgba(124,58,237,0.08)",
        }}
      />
      {/* Animated fill */}
      <motion.div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          borderRadius: 99,
          background: "linear-gradient(180deg, #7C3AED 0%, #059669 50%, #D97706 100%)",
          transformOrigin: "top",
          scaleY,
          height: "100%",
        }}
      />
      {/* Glow effect */}
      <motion.div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 20,
          height: "100%",
          borderRadius: 99,
          background: "linear-gradient(180deg, rgba(124,58,237,0.3), rgba(5,150,105,0.3), rgba(217,119,6,0.3))",
          filter: "blur(8px)",
          opacity: glowOpacity,
        }}
      />
    </div>
  );
};

/* Desktop step card — alternating left/right with straight horizontal connector */
const StepCard = ({ step, index }: { step: typeof steps[0]; index: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const isLeft = index % 2 === 0;

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        position: "relative",
        minHeight: 160,
        marginBottom: index < steps.length - 1 ? 48 : 0,
      }}
    >
      {/* Straight horizontal connector — from card edge to center timeline */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          top: "50%",
          left: isLeft ? "46%" : "50%",
          width: "4%",
          height: 3,
          transform: "translateY(-50%)",
          transformOrigin: isLeft ? "right" : "left",
          background: step.color,
          borderRadius: 2,
          zIndex: 2,
        }}
      />

      {/* Left side */}
      <div style={{ width: "46%", display: "flex", justifyContent: "flex-end", paddingRight: 40 }}>
        {isLeft && (
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{
              maxWidth: 320,
              padding: 24,
              borderRadius: 18,
              background: "rgba(255,255,255,0.85)",
              border: `1.5px solid ${step.color}20`,
              backdropFilter: "blur(12px)",
              boxShadow: `0 8px 32px ${step.color}10, 0 2px 8px rgba(0,0,0,0.04)`,
              position: "relative",
            }}
          >
            <CardContent step={step} />
          </motion.div>
        )}
      </div>

      {/* Center spacer for timeline */}
      <div style={{ width: "8%" }} />

      {/* Right side */}
      <div style={{ width: "46%", paddingLeft: 40 }}>
        {!isLeft && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{
              maxWidth: 320,
              padding: 24,
              borderRadius: 18,
              background: "rgba(255,255,255,0.85)",
              border: `1.5px solid ${step.color}20`,
              backdropFilter: "blur(12px)",
              boxShadow: `0 8px 32px ${step.color}10, 0 2px 8px rgba(0,0,0,0.04)`,
              position: "relative",
            }}
          >
            <CardContent step={step} />
          </motion.div>
        )}
      </div>
    </div>
  );
};

/* Shared card content */
const CardContent = ({ step }: { step: typeof steps[0] }) => (
  <>
    {/* Step number watermark */}
    <span
      style={{
        fontSize: 48,
        fontWeight: 900,
        color: `${step.color}10`,
        lineHeight: 1,
        position: "absolute",
        top: 10,
        right: 16,
        userSelect: "none",
      }}
    >
      {step.number}
    </span>

    {/* Icon with pulse */}
    <div style={{ position: "relative", width: 48, height: 48, marginBottom: 14 }}>
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 12,
          background: `${step.color}18`,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          background: `${step.color}12`,
          border: `2px solid ${step.color}30`,
        }}
      >
        <step.icon style={{ width: 22, height: 22, color: step.color }} />
      </div>
    </div>

    {/* Text */}
    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#2e2d2d", margin: "0 0 6px" }}>
      {step.title}
    </h3>
    <p style={{ fontSize: 13, color: "rgba(46,45,45,0.5)", lineHeight: 1.65, margin: 0 }}>
      {step.description}
    </p>
  </>
);

/* Mobile step card — stacked top-to-bottom with center vertical line */
const MobileStepCard = ({ step, index }: { step: typeof steps[0]; index: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%",
          maxWidth: 340,
          padding: 24,
          borderRadius: 16,
          background: "rgba(255,255,255,0.85)",
          border: `1.5px solid ${step.color}20`,
          backdropFilter: "blur(12px)",
          boxShadow: `0 6px 24px ${step.color}08`,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: `${step.color}12`,
              border: `2px solid ${step.color}25`,
            }}
          >
            <step.icon style={{ width: 20, height: 20, color: step.color }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: `${step.color}40`, fontFamily: "monospace" }}>
            {step.number}
          </span>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#2e2d2d", margin: "0 0 4px" }}>{step.title}</h3>
        <p style={{ fontSize: 13, color: "rgba(46,45,45,0.5)", lineHeight: 1.6, margin: 0 }}>{step.description}</p>
      </motion.div>

      {/* Vertical connector line to next card */}
      {index < steps.length - 1 && (
        <motion.div
          initial={{ scaleY: 0 }}
          animate={inView ? { scaleY: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{
            width: 3,
            height: 40,
            background: `linear-gradient(to bottom, ${step.color}, ${steps[index + 1].color})`,
            transformOrigin: "top",
            borderRadius: 2,
            margin: "0 auto",
          }}
        />
      )}
    </div>
  );
};

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      style={{
        padding: "80px 24px",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}
          >
            <span className="badge-purple">How it works</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#2e2d2d",
              margin: 0,
            }}
          >
            Three steps.{" "}
            <span className="font-serif-italic italic-shine">
              <ShinyText text="Zero friction." speed={4} color="#7C3AED" shineColor="#c4b5fd" />
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{ color: "rgba(46,45,45,0.45)", fontSize: 16, marginTop: 12 }}
          >
            From hotkey to cursor — in under a second.
          </motion.p>
        </div>

        {/* Desktop timeline — alternating left/right */}
        <div className="hidden md:block" style={{ position: "relative", minHeight: 400 }}>

          <TimelineLine />
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>

        {/* Mobile timeline — stacked top to bottom, centered */}
        <div className="flex flex-col items-center md:hidden">
          {steps.map((step, i) => (
            <MobileStepCard key={step.number} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

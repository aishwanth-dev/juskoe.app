import { motion, AnimatePresence } from "framer-motion";
import { Check, Zap, Crown, Star, Globe, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import ShinyText from "./ShinyText";

/* ── Location-aware pricing ── */
const useIsIndia = () => {
  const [isIndia, setIsIndia] = useState(false);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.startsWith("Asia/Kolkata") || tz.startsWith("Asia/Calcutta")) {
        setIsIndia(true);
      }
    } catch {
      /* fallback: not India */
    }
  }, []);
  return isIndia;
};

/* ── Plan data ── */
const getPlans = (isIndia: boolean) => [
  {
    name: "Free",
    emoji: "🆓",
    label: "Free Plan",
    price: isIndia ? "₹0" : "$0",
    period: "forever",
    monthlyPrice: null,
    yearlyPrice: null,

    icon: Zap,
    color: "#2e2d2d",
    popular: false,
    cta: "Download Free",
    usageItems: [
      "25 uses/day total",
      "10 AI (F7)",
      "15 Grammar (F8)",
      "200 uses/month (combined)",
    ],
    features: [
      "Speak → paste in any app",
      "Select text → speak to rewrite",
      "AI + grammar improvements",
      "Prompt generation (limited)",
      "App-aware formatting",
      "Local notes",
      "Local dictionary (custom words)",
      "Local snippets (saved text)",

      "No cloud sync",
    ],
  },
  {
    name: "Pro",
    emoji: "⭐",
    label: "Pro Plan",
    price: null,
    period: null,
    monthlyPrice: isIndia ? "₹359" : "$10",
    yearlyPrice: isIndia ? "₹300" : "$8",

    icon: Crown,
    color: "#7C3AED",
    popular: true,
    cta: "Upgrade to Pro",
    usageItems: [
      "Unlimited AI (F7)",
      "Unlimited Grammar (F8)",
      "Longer, more detailed outputs",
      "Priority processing",
    ],
    features: [
      "Everything in Free, plus:",
      "Cloud sync (notes, dictionary, snippets)",
      "Cross-device access",
      "Higher-quality rewrites",
      "Advanced prompt generation",
      "Stronger app-context optimization",
      "Early access to new features",
    ],
  },
];

/* ── Billing toggle ── */
const BillingToggle = ({
  isAnnual,
  onToggle,
}: {
  isAnnual: boolean;
  onToggle: () => void;
}) => (
  <div className="flex justify-center">
    <div className="relative flex items-center gap-3">
      <span
        className="text-sm font-semibold transition-colors duration-300"
        style={{ color: !isAnnual ? "#2e2d2d" : "#2e2d2d50" }}
      >
        Monthly
      </span>
      <button
        onClick={onToggle}
        className="relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0"
        style={{
          background: isAnnual
            ? "linear-gradient(135deg, #7C3AED, #a78bfa)"
            : "#c4c4c4",
          boxShadow: isAnnual
            ? "0 0 16px rgba(124,58,237,0.45), 0 0 4px rgba(124,58,237,0.3)"
            : "inset 0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <motion.div
          className="absolute top-0.5 w-6 h-6 bg-white rounded-full"
          layout
          style={{
            left: isAnnual ? 30 : 2,
            boxShadow: isAnnual
              ? "0 2px 8px rgba(124,58,237,0.3)"
              : "0 1px 4px rgba(0,0,0,0.15)",
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      <span
        className="text-sm font-semibold transition-colors duration-300"
        style={{ color: isAnnual ? "#7C3AED" : "#2e2d2d50" }}
      >
        Annual
      </span>
      {/* Absolute so it doesn't shift the centered toggle */}
      <span
        className="absolute left-full ml-3 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap transition-all duration-300"
        style={{
          background: isAnnual ? "rgba(124,58,237,0.1)" : "transparent",
          color: isAnnual ? "#7C3AED" : "transparent",
          transform: isAnnual ? "scale(1)" : "scale(0.85)",
          opacity: isAnnual ? 1 : 0,
        }}
      >
        SAVE MORE
      </span>
    </div>
  </div>
);

/* ── Pricing section ── */
const Pricing = () => {
  const isIndia = useIsIndia();
  const [isAnnual, setIsAnnual] = useState(false);
  const plans = getPlans(isIndia);

  return (
    <section id="pricing" className="relative py-20 md:py-28 px-6 overflow-hidden">
      {/* ── Decorative background ── */}
      {/* Grid tiles */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      {/* Purple radial glow — top */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
        }}
      />
      {/* Cloud-like blurs */}
      <div className="absolute top-16 left-[8%] w-72 h-44 rounded-full bg-[rgba(124,58,237,0.08)] blur-3xl pointer-events-none" />
      <div className="absolute bottom-24 right-[10%] w-60 h-40 rounded-full bg-[rgba(167,139,250,0.10)] blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-[60%] w-40 h-40 rounded-full bg-[rgba(124,58,237,0.05)] blur-2xl pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* ── Header ── */}
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-center mb-4"
          >
            <span className="badge-purple">Pricing</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#2e2d2d] mb-4"
          >
            Simple,{" "}
            <span className="font-serif-italic italic-shine">
              <ShinyText
                text="honest pricing."
                speed={4}
                color="#7C3AED"
                shineColor="#c4b5fd"
              />
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[#2e2d2d]/45 text-base max-w-md mx-auto mb-8"
          >
            Start free. Upgrade when you're ready. No surprises.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <BillingToggle
              isAnnual={isAnnual}
              onToggle={() => setIsAnnual(!isAnnual)}
            />
          </motion.div>
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto items-stretch">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const isPro = plan.popular;
            const displayPrice =
              plan.price ??
              (isAnnual ? plan.yearlyPrice : plan.monthlyPrice) ??
              "";
            const displayPeriod =
              plan.period ??
              (isAnnual ? "/mo (billed annually)" : "/mo");

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: i * 0.15,
                  duration: 0.65,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -4 }}
                className="relative flex flex-col overflow-hidden"
                style={{
                  borderRadius: 16,
                  border: isPro
                    ? "2px solid rgba(124,58,237,0.35)"
                    : "1px solid rgba(46,45,45,0.12)",
                  background: isPro
                    ? "linear-gradient(160deg, rgba(124,58,237,0.04) 0%, rgba(167,139,250,0.06) 50%, rgba(124,58,237,0.02) 100%)"
                    : "#ffffff",
                  boxShadow: isPro
                    ? "0 20px 60px rgba(124,58,237,0.15), 0 4px 16px rgba(124,58,237,0.08)"
                    : "0 4px 24px rgba(0,0,0,0.04)",
                }}
              >
                {/* Pro top gradient bar */}
                {isPro && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                      background: "linear-gradient(90deg, #7C3AED, #a78bfa, #7C3AED)",
                    }}
                  />
                )}
                {isPro && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-0.5 text-white text-[9px] font-black tracking-widest uppercase"
                    style={{
                      background: "linear-gradient(135deg, #7C3AED, #5b21b6)",
                      borderRadius: 6,
                    }}
                  >
                    <Star className="w-2.5 h-2.5" />
                    POPULAR
                  </motion.div>
                )}

                {/* Card inner — flex-col with flex-1 to stretch equally */}
                <div
                  className="relative flex flex-col flex-1 p-6"
                  style={
                    isPro
                      ? {
                        backgroundImage: `
                            linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)
                          `,
                        backgroundSize: "32px 32px",
                      }
                      : {}
                  }
                >
                  {/* ── Fixed-height top zone (label + price + desc) ── */}
                  <div style={{ minHeight: 100 }}>
                    {/* Plan label */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          background: isPro
                            ? "rgba(124,58,237,0.1)"
                            : "rgba(46,45,45,0.06)",
                        }}
                      >
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: plan.color }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-bold uppercase tracking-widest"
                        style={{ color: plan.color }}
                      >
                        {plan.label}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-1 mb-1">
                      <motion.span
                        key={displayPrice}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-black text-[#2e2d2d]"
                      >
                        {displayPrice}
                      </motion.span>
                      <span className="text-xs text-[#2e2d2d]/40">
                        {displayPeriod}
                      </span>
                    </div>


                  </div>

                  {/* ── CTA — always at same vertical position ── */}
                  <motion.a
                    href="https://firebasestorage.googleapis.com/v0/b/juskoe-7698d.firebasestorage.app/o/Juskoe%20Setup%201.0.0.exe?alt=media&token=28f7ccbe-c1e6-4996-9e13-45700324f5f3"
                    whileHover={
                      isPro
                        ? {
                          scale: 1.03,
                          boxShadow:
                            "0 16px 50px rgba(124,58,237,0.3)",
                        }
                        : { scale: 1.03, backgroundColor: "#2e2d2d", color: "#ffffff" }
                    }
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center justify-center w-full py-3 text-sm font-bold mb-5 transition-all"
                    style={{
                      borderRadius: 10,
                      ...(isPro
                        ? {
                          background:
                            "linear-gradient(135deg, #7C3AED, #5b21b6)",
                          color: "#fff",
                          border: "none",
                        }
                        : {
                          background: "transparent",
                          border: "2px solid #2e2d2d",
                          color: "#2e2d2d",
                        }),
                    }}
                  >
                    {isPro && <Sparkles className="w-4 h-4 mr-2" />}
                    {plan.cta}
                  </motion.a>

                  {/* Divider */}
                  <div
                    className="h-px mb-4"
                    style={{
                      background: isPro
                        ? "rgba(124,58,237,0.15)"
                        : "rgba(46,45,45,0.08)",
                    }}
                  />

                  {/* Usage limits */}
                  <div className="mb-4">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: plan.color }}
                    >
                      Usage
                    </p>
                    <div className="space-y-1.5">
                      {plan.usageItems.map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              background: isPro ? "#7C3AED" : "#2e2d2d",
                              opacity: isPro ? 1 : 0.3,
                            }}
                          />
                          <span className="text-[13px] text-[#2e2d2d]/70">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    className="h-px mb-4"
                    style={{
                      background: isPro
                        ? "rgba(124,58,237,0.10)"
                        : "rgba(46,45,45,0.06)",
                    }}
                  />

                  {/* Includes */}
                  <div className="flex-1">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: plan.color }}
                    >
                      Includes
                    </p>
                    <div className="space-y-1.5">
                      {plan.features.map((feat) => (
                        <div key={feat} className="flex items-center gap-2">
                          <div
                            className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"
                            style={{
                              borderRadius: 4,
                              background: isPro
                                ? "rgba(124,58,237,0.12)"
                                : "rgba(46,45,45,0.08)",
                            }}
                          >
                            <Check
                              className="w-2 h-2"
                              style={{ color: plan.color }}
                            />
                          </div>
                          <span className="text-[13px] text-[#2e2d2d]/70">
                            {feat}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Location note ── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-2 mt-8"
        >
          <Globe className="w-3.5 h-3.5 text-[#2e2d2d]/35" />
          <p className="text-xs text-[#2e2d2d]/35">
            {isIndia
              ? "Prices shown in ₹ (India) · Cancel anytime · No credit card for free plan"
              : "Prices shown in $ (USD) · Cancel anytime · No credit card for free plan"}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;

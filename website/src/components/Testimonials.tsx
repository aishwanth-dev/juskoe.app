import { motion } from "framer-motion";
import ShinyText from "./ShinyText";

const testimonials = [
  {
    image: "https://images.unsplash.com/photo-1618641986557-1ecd230959aa?q=80&w=200&h=200&fit=crop",
    name: "Ravi Shankar",
    role: "Backend Developer, Bangalore",
    text: "Honestly I installed juskoe just to try it out but now I literally can't work without it. I speak my commit messages, PR descriptions, everything. My team thinks I type super fast lol.",
  },
  {
    image: null,
    name: "Meera Nair",
    role: "Content Writer",
    text: "The grammar mode is genuinely good. I write blog posts by just talking and F8 cleans up everything. My editor noticed my writing quality went up and I didn't tell her why 😂",
  },
  {
    image: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=200&h=200&fit=crop",
    name: "Arjun Mehta",
    role: "Product Manager, Mumbai",
    text: "I send like 100+ Slack messages daily. Earlier I'd type everything out, now I just hold F7 and speak. The AI actually understands context and formats it properly for Slack vs email vs docs.",
  },
  {
    image: "https://images.unsplash.com/photo-1611432579699-484f7990b127?q=80&w=200&h=200&fit=crop",
    name: "Sneha Reddy",
    role: "Freelance Designer",
    text: "Was looking for something like this for so long. I dictate all my client emails and Figma comments now. The fact that it works in ANY app is what sold me. No copy-paste needed.",
  },
  {
    image: null,
    name: "Karthik S",
    role: "CS Student, Chennai",
    text: "Free plan is actually usable unlike most apps. I use it for my assignment writeups and the grammar fix is a lifesaver. Thinking of going pro next month for unlimited AI.",
  },
  {
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&h=200&fit=crop",
    name: "Vikram Joshi",
    role: "Startup Founder, Hyderabad",
    text: "Privacy was the main thing for me. Audio never leaves my laptop - that's huge. I dictate investor updates, pitch decks, everything. Saves me easily 1-2 hours daily.",
  },
  {
    image: "https://images.unsplash.com/photo-1602233158242-3ba0ac4d2167?q=80&w=200&h=200&fit=crop",
    name: "Priya Sharma",
    role: "HR Manager",
    text: "Our whole HR team started using it after I showed them. Writing offer letters, policy docs, review feedback - everything by voice. The AI mode drafts things so well we barely edit.",
  },
  {
    image: null,
    name: "Aditya P",
    role: "Data Analyst, Pune",
    text: "I'm that person who hates typing long emails. Now I just talk for 20 seconds, F7 does its thing, and I get a perfectly written email. My manager actually complimented my communication skills recently.",
  },
  {
    image: "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?q=80&w=200&h=200&fit=crop",
    name: "Deepak Kumar",
    role: "DevOps Engineer",
    text: "Using it for documentation mostly. I speak what the system does and juskoe turns it into proper technical docs. Beats staring at a blank page for 30 minutes trying to write.",
  },
];

const col1 = testimonials.slice(0, 3);
const col2 = testimonials.slice(3, 6);
const col3 = testimonials.slice(6, 9);

// Generate initials avatar for users without profile image
const InitialsAvatar = ({ name }: { name: string }) => {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  // Generate a consistent color from the name
  const colors = ["#7C3AED", "#6366f1", "#8b5cf6", "#a78bfa", "#6d28d9"];
  const colorIndex = name.length % colors.length;
  return (
    <div
      className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
      style={{ backgroundColor: colors[colorIndex] }}
    >
      {initials}
    </div>
  );
};

const TestimonialCard = ({ t }: { t: typeof testimonials[0] }) => (
  <div className="p-6 rounded-2xl bg-white border border-[rgba(124,58,237,0.1)] shadow-card mb-5">
    <p className="text-[#2e2d2d]/70 text-sm leading-relaxed mb-5">"{t.text}"</p>
    <div className="flex items-center gap-3">
      {t.image ? (
        <img
          src={t.image}
          alt={t.name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[rgba(124,58,237,0.15)]"
        />
      ) : (
        <InitialsAvatar name={t.name} />
      )}
      <div>
        <p className="text-sm font-semibold text-[#2e2d2d]">{t.name}</p>
        <p className="text-xs text-[#2e2d2d]/45">{t.role}</p>
      </div>
    </div>
  </div>
);

const Testimonials = () => {
  return (
    <section className="py-24 md:py-36 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-center mb-4"
          >
            <span className="badge-purple">People love Juskoe</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#2e2d2d]"
          >
            Trusted by those who{" "}
            <span className="font-serif-italic italic-shine">
              <ShinyText text="type a lot." speed={4} color="#2e2d2d" shineColor="#7C3AED" />
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[#2e2d2d]/45 text-lg mt-4 max-w-xl mx-auto"
          >
            From developers to founders to support teams — everyone who writes constantly is switching to voice.
          </motion.p>
        </div>

        {/* Columns */}
        <div className="relative">
          {/* Top fade */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#f5f3ff] to-transparent z-10 pointer-events-none" />
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f5f3ff] to-transparent z-10 pointer-events-none" />

          <div className="flex gap-5" style={{ height: 540, overflow: "hidden" }}>
            {/* Column 1 - scrolls up */}
            <div className="flex-1 hidden md:block" style={{ overflow: "hidden" }}>
              <motion.div
                animate={{ y: ["0%", "-50%"] }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              >
                {[...col1, ...col1].map((t, i) => <TestimonialCard key={`c1-${i}`} t={t} />)}
              </motion.div>
            </div>

            {/* Column 2 - scrolls down */}
            <div className="flex-1" style={{ overflow: "hidden" }}>
              <motion.div
                animate={{ y: ["-50%", "0%"] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              >
                {[...col2, ...col2].map((t, i) => <TestimonialCard key={`c2-${i}`} t={t} />)}
              </motion.div>
            </div>

            {/* Column 3 - scrolls up (hidden on mobile) */}
            <div className="flex-1 hidden md:block" style={{ overflow: "hidden" }}>
              <motion.div
                animate={{ y: ["0%", "-50%"] }}
                transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
              >
                {[...col3, ...col3].map((t, i) => <TestimonialCard key={`c3-${i}`} t={t} />)}
              </motion.div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Testimonials;

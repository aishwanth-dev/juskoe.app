import { motion } from "framer-motion";

// Using colored SVG logo URLs — simple-icons CDN returns black SVGs,
// so we tint them using inline color-matched backgrounds and image filters
const apps = [
  { name: "Gmail", bg: "#EA4335", icon: "📧", emoji: true },
  { name: "WhatsApp", bg: "#25D366", icon: "💬", emoji: true },
  { name: "VS Code", bg: "#007ACC", icon: "⌨️", emoji: true },
  { name: "Notion", bg: "#000000", icon: "📝", emoji: true },
  { name: "Slack", bg: "#4A154B", icon: "💼", emoji: true },
  { name: "Chrome", bg: "#4285F4", icon: "🌐", emoji: true },
  { name: "Discord", bg: "#5865F2", icon: "🎮", emoji: true },
  { name: "Figma", bg: "#F24E1E", icon: "🎨", emoji: true },
  { name: "Word", bg: "#2B579A", icon: "📄", emoji: true },
  { name: "Telegram", bg: "#26A5E4", icon: "✈️", emoji: true },
  { name: "GitHub", bg: "#181717", icon: "🐙", emoji: true },
  { name: "Zoom", bg: "#2D8CFF", icon: "📹", emoji: true },
  { name: "Outlook", bg: "#0078D4", icon: "📮", emoji: true },
  { name: "Teams", bg: "#6264A7", icon: "👥", emoji: true },
  { name: "Linear", bg: "#5E6AD2", icon: "📐", emoji: true },
  { name: "Cursor", bg: "#000000", icon: "🖱️", emoji: true },
  { name: "Antigravity", bg: "#4285F4", icon: "🚀", emoji: true },
  { name: "Emergent", bg: "#A855F7", icon: "✨", emoji: true },
  { name: "Lovable", bg: "#FF385C", icon: "❤️", emoji: true },
  { name: "Trae", bg: "#00D4FF", icon: "⚡", emoji: true },
  { name: "Windsurf", bg: "#38BDF8", icon: "🌊", emoji: true },
];

// All icons stored locally in /public/icons/ for reliable loading
const appLogos: Record<string, string> = {
  "Gmail": "/icons/gmail.svg",
  "WhatsApp": "/icons/whatsapp.svg",
  "VS Code": "/icons/vscode.png",
  "Notion": "/icons/notion.svg",
  "Slack": "/icons/slack.svg",
  "Chrome": "/icons/chrome.webp",
  "Discord": "/icons/discord.svg",
  "Figma": "/icons/figma.svg",
  "Word": "/icons/word.webp",
  "Telegram": "/icons/telegram.svg",
  "GitHub": "/icons/github.svg",
  "Zoom": "/icons/zoom.svg",
  "Outlook": "/icons/outlook.ico",
  "Teams": "/icons/teams.webp",
  "Linear": "/icons/linear.svg",
  "Cursor": "/icons/cursor.svg",
  "Antigravity": "/icons/antigravity.jpg",
  "Emergent": "/icons/emergent.jpg",
  "Lovable": "/icons/lovable.png",
  "Trae": "/icons/trae.avif",
  "Windsurf": "/icons/windsurf.jpg",
};

const AppCard = ({ app }: { app: typeof apps[0] }) => (
  <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 mx-2 rounded-2xl bg-white border border-[rgba(124,58,237,0.1)] shadow-card">
    <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-white flex-shrink-0 border border-black/[0.06]">
      <img
        src={appLogos[app.name]}
        alt={app.name}
        className="w-7 h-7 object-contain"
        onError={(e) => {
          const t = e.target as HTMLImageElement;
          t.style.display = "none";
          t.parentElement!.innerHTML = `<span style="font-size:18px">${app.icon}</span>`;
        }}
      />
    </div>
    <span className="text-sm font-semibold text-[#2e2d2d] whitespace-nowrap">{app.name}</span>
  </div>
);

// Triplicate to ensure seamless loop with no gap/jump
const AppMarquee = () => {
  const row1 = apps.slice(0, 11);
  const row2 = apps.slice(11);

  return (
    <section className="py-20 overflow-hidden bg-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12 px-6"
      >
        <span className="badge-purple mb-4 inline-flex">Works everywhere</span>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2e2d2d] mt-4">
          One voice, every app
        </h2>
        <p className="text-[#2e2d2d]/50 mt-3 text-lg">
          jus声 works system-wide — any text field in any application.
        </p>
      </motion.div>

      {/* Row 1 — left scroll — triplicated for seamless loop */}
      <div className="relative mb-4 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        <div
          className="flex"
          style={{
            animation: "marquee-css 28s linear infinite",
            width: "max-content",
          }}
        >
          {/* 3 copies for seamless loop */}
          {[...row1, ...row1, ...row1].map((app, i) => <AppCard key={`r1-${i}`} app={app} />)}
        </div>
      </div>

      {/* Row 2 — right scroll */}
      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        <div
          className="flex"
          style={{
            animation: "marquee-reverse-css 32s linear infinite",
            width: "max-content",
          }}
        >
          {[...row2, ...row2, ...row2].map((app, i) => <AppCard key={`r2-${i}`} app={app} />)}
        </div>
      </div>
    </section>
  );
};

export default AppMarquee;

import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState, useCallback } from "react";
import logo from "@/assets/juskoe-logo.png";
import StarBorder from "./StarBorder";
import "./StarBorder.css";

const DOWNLOAD_URL =
  "https://firebasestorage.googleapis.com/v0/b/juskoe-7698d.firebasestorage.app/o/Juskoe%20Setup%201.0.0.exe?alt=media&token=28f7ccbe-c1e6-4996-9e13-45700324f5f3";

const navItems = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Robust scroll handler — works on both home and subpages
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setMobileOpen(false);

      // If on a subpage (e.g. /about, /terms), navigate to home first
      if (location.pathname !== "/") {
        window.location.href = "/" + href;
        return;
      }

      const id = href.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [location.pathname]
  );

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 20,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          justifyContent: "center",
          padding: "0 16px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: "100%", maxWidth: 680 }}
        >
          <StarBorder color="#7C3AED" speed="6s">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
              }}
            >
              {/* Logo */}
              <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
                <img src={logo} alt="juskoe" style={{ height: 28, width: 28 }} />
                <span style={{ lineHeight: 1, fontSize: 18 }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, color: "#2e2d2d" }}>jus</span>
                  <span style={{ fontFamily: "'Times New Roman', Times, Georgia, serif", fontStyle: "italic", fontWeight: 700, color: "#2e2d2d" }}>
                    koe.
                  </span>
                </span>
              </Link>

              {/* Desktop nav */}
              <div className="hidden md:flex" style={{ alignItems: "center", gap: 4 }}>
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    style={{
                      fontSize: 14,
                      color: "rgba(46,45,45,0.55)",
                      padding: "6px 14px",
                      fontWeight: 500,
                      borderRadius: 8,
                      textDecoration: "none",
                      transition: "all 0.2s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#7C3AED";
                      e.currentTarget.style.backgroundColor = "rgba(124,58,237,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "rgba(46,45,45,0.55)";
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>

              {/* Right side */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <a
                  href={DOWNLOAD_URL}
                  className="hidden md:inline-flex"
                  style={{
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 20px",
                    backgroundColor: "#2e2d2d",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 8,
                    textDecoration: "none",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#5b21b6";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#2e2d2d";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <svg style={{ width: 14, height: 14, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" /></svg>
                  Download
                </a>
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden"
                  style={{ padding: 6, color: "#2e2d2d", background: "none", border: "none", cursor: "pointer" }}
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
                </button>
              </div>
            </div>
          </StarBorder>
        </motion.div>
      </nav>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden"
            style={{
              position: "fixed",
              top: 88,
              left: 16,
              right: 16,
              zIndex: 40,
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(124,58,237,0.12)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.1)",
              borderRadius: 14,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                style={{
                  fontSize: 14,
                  color: "rgba(46,45,45,0.7)",
                  fontWeight: 500,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </a>
            ))}
            <a
              href={DOWNLOAD_URL}
              onClick={() => setMobileOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 20px",
                backgroundColor: "#2e2d2d",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 8,
                textDecoration: "none",
                marginTop: 4,
              }}
            >
              Download
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;

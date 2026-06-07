import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AppMarquee from "@/components/AppMarquee";
import { ThreeModes, BuiltForYou } from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";

import Testimonials from "@/components/Testimonials";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import SectionClouds from "@/components/SectionClouds";
import BigJuskoeText from "@/components/BigJuskoeText";
import Pricing from "@/components/Pricing";

/*
  LAYER ORDER (bottom → top):
  1. backgroundColor (purple gradient on sections)
  2. bg-grid tiles (via CSS class) — only on Hero + ThreeModes + CTA + Pricing
  3. Clouds (per-section, scroll-animated, z-2)
  4. Content (z-3)
*/

const Index = () => {
  return (
    <SmoothScroll>
      <div className="min-h-screen">
        <Navbar />

        {/* Hero — tiles + purple bg + clouds */}
        <section className="bg-grid" style={{ backgroundColor: "#ede9fe" }}>
          <SectionClouds variant="hero">
            <Hero />
          </SectionClouds>
        </section>

        <AppMarquee />

        {/* Three Modes — WITH tiles + clouds (dark bg) */}
        <section className="bg-grid" style={{ backgroundColor: "#0f0520" }}>
          <SectionClouds variant="features" cloudsAbove>
            <ThreeModes />
          </SectionClouds>
        </section>

        {/* Pricing — tiles + light purple bg */}
        <section style={{ backgroundColor: "#faf5ff" }}>
          <Pricing />
        </section>

        {/* Built For You — no clouds */}
        <section style={{ backgroundColor: "#f5f3ff" }}>
          <BuiltForYou />
        </section>

        {/* How It Works — plain white */}
        <section style={{ backgroundColor: "#ffffff" }}>
          <HowItWorks />
        </section>



        {/* Testimonials */}
        <section style={{ backgroundColor: "#faf9ff" }}>
          <Testimonials />
        </section>

        {/* CTA — tiles + purple bg + clouds */}
        <section className="bg-grid" style={{ backgroundColor: "#ede9fe" }}>
          <SectionClouds variant="cta">
            <CTA />
          </SectionClouds>
        </section>

        {/* Big juskoe text */}
        <section style={{ backgroundColor: "#faf9ff" }}>
          <BigJuskoeText />
        </section>

        <Footer />
      </div>
    </SmoothScroll>
  );
};

export default Index;

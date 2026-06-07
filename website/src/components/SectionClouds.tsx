import { useScroll, useTransform, motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import cloudImg from "@/assets/image.png";

/*
  Section-specific clouds with scroll-driven animations.
  On mobile (< 768px), clouds are smaller and more transparent
  to avoid covering content while still being visible.
*/

const MOBILE_BREAKPOINT = 768;

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);
    return isMobile;
};

interface CloudConfig {
    top: string;
    side: "left" | "right";
    offset: string;
    width: number;
    rotate: number;
    flipX?: boolean;
    scrollDrift: number;
    yDrift: number;
}

const configs: Record<string, CloudConfig[]> = {
    hero: [
        { top: "0%", side: "left", offset: "5%", width: 550, rotate: -2, scrollDrift: -350, yDrift: -130 },
        { top: "0%", side: "right", offset: "5%", width: 520, rotate: 2, flipX: true, scrollDrift: 350, yDrift: -120 },
        { top: "22%", side: "left", offset: "-2%", width: 340, rotate: 4, scrollDrift: -250, yDrift: -80 },
        { top: "30%", side: "right", offset: "-1%", width: 360, rotate: -3, flipX: true, scrollDrift: 260, yDrift: -70 },
        { top: "48%", side: "left", offset: "0%", width: 380, rotate: 2, scrollDrift: -220, yDrift: -50 },
        { top: "55%", side: "right", offset: "-2%", width: 350, rotate: -2, flipX: true, scrollDrift: 240, yDrift: -45 },
        { top: "72%", side: "left", offset: "-3%", width: 300, rotate: 6, scrollDrift: -200, yDrift: -30 },
        { top: "82%", side: "right", offset: "0%", width: 320, rotate: -5, flipX: true, scrollDrift: 200, yDrift: -25 },
    ],
    features: [
        { top: "5%", side: "right", offset: "-12%", width: 420, rotate: 3, scrollDrift: 260, yDrift: -90 },
        { top: "30%", side: "left", offset: "-14%", width: 400, rotate: -2, scrollDrift: -240, yDrift: -70 },
        { top: "60%", side: "right", offset: "-10%", width: 380, rotate: 4, flipX: true, scrollDrift: 220, yDrift: -55 },
        { top: "80%", side: "left", offset: "-12%", width: 360, rotate: 2, scrollDrift: -200, yDrift: -40 },
    ],
    cta: [
        { top: "5%", side: "left", offset: "-10%", width: 440, rotate: 2, scrollDrift: -280, yDrift: -80 },
        { top: "10%", side: "right", offset: "-12%", width: 420, rotate: -3, flipX: true, scrollDrift: 260, yDrift: -70 },
        { top: "50%", side: "left", offset: "-14%", width: 380, rotate: 4, scrollDrift: -220, yDrift: -50 },
        { top: "65%", side: "right", offset: "-10%", width: 400, rotate: -2, flipX: true, scrollDrift: 230, yDrift: -40 },
    ],
    usecases: [
        { top: "5%", side: "right", offset: "-12%", width: 400, rotate: 2, scrollDrift: 240, yDrift: -70 },
        { top: "30%", side: "left", offset: "-14%", width: 380, rotate: -3, scrollDrift: -220, yDrift: -55 },
        { top: "60%", side: "right", offset: "-10%", width: 360, rotate: 4, flipX: true, scrollDrift: 200, yDrift: -40 },
        { top: "82%", side: "left", offset: "-12%", width: 340, rotate: 2, scrollDrift: -180, yDrift: -30 },
    ],
};

const Cloud = ({
    cloud,
    containerRef,
    isMobile,
}: {
    cloud: CloudConfig;
    containerRef: React.RefObject<HTMLDivElement>;
    isMobile: boolean;
}) => {
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    // On mobile: reduce drift and use smaller sizes
    const mobileScale = isMobile ? 0.45 : 1;
    const mobileDrift = isMobile ? 0.3 : 1;

    const x = useTransform(
        scrollYProgress,
        [0, 0.2, 0.6, 1],
        [0, 0, cloud.scrollDrift * 0.4 * mobileDrift, cloud.scrollDrift * mobileDrift]
    );
    const y = useTransform(scrollYProgress, [0, 1], [0, cloud.yDrift * mobileDrift]);
    const opacity = useTransform(
        scrollYProgress,
        [0, 0.08, 0.35, 0.8, 1],
        isMobile ? [0, 0.5, 0.5, 0.35, 0] : [0, 1, 1, 0.7, 0]
    );

    return (
        <motion.img
            src={cloudImg}
            alt=""
            draggable={false}
            style={{
                position: "absolute",
                top: cloud.top,
                [cloud.side]: cloud.offset,
                width: cloud.width * mobileScale,
                transform: `rotate(${cloud.rotate}deg)${cloud.flipX ? " scaleX(-1)" : ""}`,
                filter: "drop-shadow(0 12px 32px rgba(100,80,160,0.15)) drop-shadow(0 4px 12px rgba(0,0,0,0.08))",
                zIndex: 2,
                pointerEvents: "none",
                x,
                y,
                opacity,
            }}
        />
    );
};

interface SectionCloudsProps {
    variant: "hero" | "features" | "cta" | "usecases";
    children: React.ReactNode;
    cloudsAbove?: boolean;
}

const SectionClouds = ({ variant, children, cloudsAbove = false }: SectionCloudsProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const cloudList = configs[variant] || [];

    const cloudElements = cloudList.map((cloud, i) => (
        <Cloud key={`${variant}-${i}`} cloud={cloud} containerRef={ref as React.RefObject<HTMLDivElement>} isMobile={isMobile} />
    ));

    return (
        <div ref={ref} style={{ position: "relative", overflow: "hidden" }}>
            {!cloudsAbove && cloudElements}
            <div style={{ position: "relative", zIndex: cloudsAbove ? 1 : 3 }}>
                {children}
            </div>
            {cloudsAbove && (
                <div style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none" }}>
                    {cloudElements}
                </div>
            )}
        </div>
    );
};

export default SectionClouds;

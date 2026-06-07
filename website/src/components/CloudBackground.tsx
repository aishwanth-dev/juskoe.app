import { useScroll, useTransform, motion } from "framer-motion";
import cloudImg from "@/assets/image.png";

/*
  Clouds sit at z-index: 5 — between tiles (z:1) and content (z:10).
  3 clouds half-peeking from the left/right edges.
  They use position:fixed so they stay visible as the user scrolls,
  with parallax transforming their Y based on scroll progress.
*/

const clouds = [
    { id: 1, top: "8%", side: "left" as const, offset: "-14%", width: 500, rotate: 0, speed: 0.15, opacity: 0.35 },
    { id: 2, top: "44%", side: "right" as const, offset: "-16%", width: 560, rotate: 6, speed: 0.2, opacity: 0.3 },
    { id: 3, top: "76%", side: "left" as const, offset: "-18%", width: 480, rotate: -4, speed: 0.12, opacity: 0.32 },
];

const CloudImage = ({ cloud, scrollY }: { cloud: typeof clouds[0]; scrollY: any }) => {
    const y = useTransform(scrollY, [0, 1], [0, cloud.speed * -350]);

    return (
        <motion.img
            src={cloudImg}
            alt=""
            draggable={false}
            style={{
                position: "fixed",
                top: cloud.top,
                [cloud.side]: cloud.offset,
                width: cloud.width,
                opacity: cloud.opacity,
                transform: `rotate(${cloud.rotate}deg)`,
                filter: "blur(1px)",
                zIndex: 15,
                pointerEvents: "none",
                y,
            }}
        />
    );
};

const CloudBackground = ({ children }: { children: React.ReactNode }) => {
    const { scrollYProgress } = useScroll();

    return (
        <div style={{ position: "relative" }}>
            {/* Layer 3: clouds (z-15, above content) */}
            {clouds.map((cloud) => (
                <CloudImage key={cloud.id} cloud={cloud} scrollY={scrollYProgress} />
            ))}

            {/* Layer 4: content (z-10) */}
            <div style={{ position: "relative", zIndex: 10 }}>
                {children}
            </div>
        </div>
    );
};

export default CloudBackground;

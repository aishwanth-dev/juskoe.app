import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";

const letters = [
    { char: "j", font: "Inter, sans-serif", weight: 900, italic: false },
    { char: "u", font: "Inter, sans-serif", weight: 900, italic: false },
    { char: "s", font: "Inter, sans-serif", weight: 900, italic: false },
    { char: "k", font: "'Times New Roman', Times, Georgia, serif", weight: 700, italic: true },
    { char: "o", font: "'Times New Roman', Times, Georgia, serif", weight: 700, italic: true },
    { char: "e", font: "'Times New Roman', Times, Georgia, serif", weight: 700, italic: true },
    { char: ".", font: "'Times New Roman', Times, Georgia, serif", weight: 700, italic: true },
];

const BigJuskoeText = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });

    const scale = useTransform(scrollYProgress, [0, 0.5], [0.7, 1]);
    const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0.3]);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    return (
        <section ref={ref} className="py-20 md:py-32 px-6 overflow-hidden relative">
            <motion.div
                style={{ scale, opacity }}
                className="text-center"
            >
                <h2
                    style={{
                        lineHeight: 0.85,
                        display: "inline-flex",
                        alignItems: "baseline",
                        justifyContent: "center",
                        cursor: "default",
                    }}
                    className="text-[6rem] sm:text-[8rem] md:text-[12rem] lg:text-[16rem] leading-none tracking-tighter select-none"
                >
                    {letters.map((l, i) => (
                        <span
                            key={i}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            style={{
                                fontFamily: l.font,
                                fontWeight: l.weight,
                                fontStyle: l.italic ? "italic" : "normal",
                                color: hoveredIdx === i ? "#2e2d2d" : "rgba(200, 180, 220, 0.45)",
                                textShadow: hoveredIdx === i
                                    ? "0 0 30px rgba(46,45,45,0.5), 0 0 60px rgba(46,45,45,0.25)"
                                    : "none",
                                transition: "color 0.3s ease, text-shadow 0.3s ease",
                                display: "inline-block",
                            }}
                        >
                            {l.char}
                        </span>
                    ))}
                </h2>
            </motion.div>
        </section>
    );
};

export default BigJuskoeText;

"use client";

import { motion, useReducedMotion } from "framer-motion";

const BULBS = 22;
const COLORS = ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"];

function bulbTop(t: number) {
  const y = (1 - t) ** 2 * 18 + 2 * (1 - t) * t * 78 + t ** 2 * 18;
  return `${y}%`;
}

export default function Garland() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-30 h-20 md:h-24"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 100"
        preserveAspectRatio="none"
      >
        <path
          d="M0 18 Q600 78 1200 18"
          fill="none"
          stroke="#334155"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M0 18 Q600 78 1200 18"
          fill="none"
          stroke="#0f172a"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {Array.from({ length: BULBS }).map((_, index) => {
        const t = index / (BULBS - 1);
        const color = COLORS[index % COLORS.length];

        return (
          <motion.span
            key={index}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${t * 100}%`,
              top: bulbTop(t),
              backgroundColor: color,
              boxShadow: `0 0 12px 3px ${color}`,
            }}
            animate={
              reduceMotion
                ? undefined
                : { opacity: [1, 0.3, 1], scale: [1, 1.18, 1] }
            }
            transition={{
              duration: 1.9,
              repeat: Infinity,
              delay: index * 0.07,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}

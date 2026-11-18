"use client";

import { motion, useReducedMotion } from "framer-motion";

type Particle = {
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  drift: number;
};

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const random = seededRandom(20261224);

const PARTICLES: Particle[] = Array.from({ length: 48 }, () => {
  const size = 2 + random() * 6;
  return {
    left: random() * 100,
    size,
    delay: random() * 12,
    duration: 9 + random() * 12,
    opacity: 0.25 + random() * 0.55,
    drift: (random() - 0.5) * 90,
  };
});

export default function Snowfall() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {PARTICLES.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-white"
          style={{
            left: `${particle.left}%`,
            width: particle.size,
            height: particle.size,
            boxShadow: "0 0 7px rgba(255,255,255,0.85)",
            filter: particle.size > 5.5 ? "blur(0.6px)" : undefined,
            willChange: "transform, opacity",
          }}
          initial={{ y: "-10vh", x: 0, opacity: 0 }}
          animate={{
            y: "110vh",
            x: particle.drift,
            opacity: [0, particle.opacity, particle.opacity, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

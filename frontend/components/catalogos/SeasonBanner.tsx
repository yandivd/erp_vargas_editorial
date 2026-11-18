"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function SeasonBanner() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-amber-300/60 bg-gradient-to-r from-red-900 via-red-700 to-red-900 px-6 py-3 shadow-[0_0_35px_rgba(220,38,38,0.35)]">
      <span className="relative z-10 text-base font-extrabold tracking-wide text-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] md:text-lg">
        🎄 ¡Felices Fiestas! 🎁
      </span>
      {!reduceMotion ? (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"
          animate={{ x: ["0%", "420%"] }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            repeatDelay: 2.2,
            ease: "easeInOut",
          }}
        />
      ) : null}
    </div>
  );
}

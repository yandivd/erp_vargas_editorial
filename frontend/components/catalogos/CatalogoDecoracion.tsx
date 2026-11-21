"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { normalizarTemaDecoracion, type TemaDecoracion } from "@/lib/decoracion";

const SNOW = Array.from({ length: 48 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(n * 999) * 10000;
    return x - Math.floor(x);
  };
  const size = 2 + r(i + 1) * 6;
  return { left: r(i + 10) * 100, size, delay: r(i + 20) * 12, duration: 9 + r(i + 30) * 12, opacity: 0.25 + r(i + 40) * 0.55, drift: (r(i + 50) - 0.5) * 90 };
});

const BATS = ["🦇", "🦇", "🕸️", "🦇", "🎃"];

function SeasonBanner({ tema }: { tema: TemaDecoracion }) {
  const reduceMotion = useReducedMotion();
  const text = tema === "halloween" ? "🎃 ¡Feliz Halloween! 👻" : "🎄 ¡Felices Fiestas! 🎁";
  const cls = tema === "halloween"
    ? "border-orange-400/60 bg-gradient-to-r from-orange-950 via-orange-800 to-orange-950 shadow-[0_0_35px_rgba(249,115,22,0.35)]"
    : "border-amber-300/60 bg-gradient-to-r from-red-900 via-red-700 to-red-900 shadow-[0_0_35px_rgba(220,38,38,0.35)]";
  return (
    <div className={`relative mt-4 overflow-hidden rounded-2xl border px-6 py-3 ${cls}`}>
      <span className="relative z-10 text-base font-extrabold tracking-wide text-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] md:text-lg">{text}</span>
      {!reduceMotion ? (
        <motion.span aria-hidden="true" className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent" animate={{ x: ["0%", "420%"] }} transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }} />
      ) : null}
    </div>
  );
}

function Snowfall() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (reduceMotion || !mounted) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {SNOW.map((p, i) => (
        <motion.span key={i} className="absolute rounded-full bg-white" style={{ left: `${p.left}%`, width: p.size, height: p.size, boxShadow: "0 0 7px rgba(255,255,255,0.85)", willChange: "transform, opacity" }} initial={{ y: "-10vh", x: 0, opacity: 0 }} animate={{ y: "110vh", x: p.drift, opacity: [0, p.opacity, p.opacity, 0] }} transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "linear" }} />
      ))}
    </div>
  );
}

function Garland({ tema }: { tema: TemaDecoracion }) {
  const reduceMotion = useReducedMotion();
  const colors = tema === "halloween" ? ["#fb923c", "#a855f7", "#84cc16", "#fb923c", "#f97316"] : ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"];
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-30 h-20 md:h-24">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 100" preserveAspectRatio="none">
        <path d="M0 18 Q600 78 1200 18" fill="none" stroke="#334155" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: 22 }).map((_, index) => {
        const t = index / 21;
        const color = colors[index % colors.length];
        const y = (1 - t) ** 2 * 18 + 2 * (1 - t) * t * 78 + t ** 2 * 18;
        return <motion.span key={index} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${t * 100}%`, top: `${y}%`, backgroundColor: color, boxShadow: `0 0 12px 3px ${color}` }} animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1], scale: [1, 1.18, 1] }} transition={{ duration: 1.9, repeat: Infinity, delay: index * 0.07, ease: "easeInOut" }} />;
      })}
    </div>
  );
}

function HalloweenFloaters() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {BATS.map((icon, i) => (
        <motion.span key={i} className="absolute text-2xl md:text-4xl" style={{ left: `${10 + i * 18}%`, top: `${8 + (i % 3) * 8}%` }} animate={{ y: [0, -12, 0], rotate: [0, i % 2 ? 8 : -8, 0] }} transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}>
          {icon}
        </motion.span>
      ))}
    </div>
  );
}

export function CatalogoDecoracion({ tema: rawTema }: { tema: TemaDecoracion }) {
  const tema = normalizarTemaDecoracion(rawTema);
  if (tema === "ninguno") return null;

  if (tema === "halloween") {
    return (
      <>
        <HalloweenFloaters />
        <Garland tema="halloween" />
      </>
    );
  }

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-24 opacity-70 sm:block md:w-40 lg:w-56" style={{ backgroundImage: "url('/img/navidad/pine-left.svg')", backgroundSize: "cover", backgroundPosition: "center center", backgroundRepeat: "no-repeat" }} />
      <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 right-0 z-0 hidden w-24 opacity-70 sm:block md:w-40 lg:w-56" style={{ backgroundImage: "url('/img/navidad/pine-right.svg')", backgroundSize: "cover", backgroundPosition: "center center", backgroundRepeat: "no-repeat" }} />
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-24 w-full md:h-32" style={{ backgroundImage: "url('/img/navidad/snow-bottom.svg')", backgroundSize: "100% 100%", backgroundPosition: "bottom", backgroundRepeat: "no-repeat" }} />
      <Snowfall />
      <Garland tema="navidad" />
    </>
  );
}

export function CatalogoSeasonBanner({ tema }: { tema: TemaDecoracion }) {
  const t = normalizarTemaDecoracion(tema);
  if (t === "ninguno") return null;
  return <SeasonBanner tema={t} />;
}

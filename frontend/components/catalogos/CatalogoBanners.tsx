"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { BannerPublico } from "@/lib/banners";

type CatalogoBannersProps = {
  banners: BannerPublico[];
};

export default function CatalogoBanners({ banners }: CatalogoBannersProps) {
  const reduceMotion = useReducedMotion();
  const activos: BannerPublico[] = banners.length
    ? banners
    : [{ id: 0, titulo: "Vargas Editorial", imagen: "/img/catalogo/banner-1.png" }];
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (activos.length < 2) {
      return;
    }
    const intervalo = window.setInterval(() => {
      setIndice((valor) => (valor + 1) % activos.length);
    }, 1500);
    return () => window.clearInterval(intervalo);
  }, [activos.length]);

  const activo = activos[indice % activos.length];

  return (
    <section
      className="relative z-10 mx-auto mt-3 aspect-[970/300] w-full max-w-[970px] overflow-hidden border-y border-amber-300/20 bg-slate-950"
      role="img"
      aria-label={activo.titulo || "Banner del catálogo"}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={activo.id}
          className="absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${JSON.stringify(activo.imagen)})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeInOut" }}
        />
      </AnimatePresence>
    </section>
  );
}

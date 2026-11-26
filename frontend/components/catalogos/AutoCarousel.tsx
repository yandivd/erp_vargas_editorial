"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";

type AutoCarouselProps = {
  children: ReactNode;
  itemCount: number;
  ariaLabel: string;
  className?: string;
};

export default function AutoCarousel({
  children,
  itemCount,
  ariaLabel,
  className = "",
}: AutoCarouselProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const pausadoRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const mover = useCallback(
    (direccion: 1 | -1) => {
      const contenedor = contenedorRef.current;
      const pista = contenedor?.firstElementChild as HTMLElement | null;
      const primerItem = pista?.firstElementChild as HTMLElement | null;
      if (!contenedor || !pista || !primerItem) {
        return;
      }

      const estilo = window.getComputedStyle(pista);
      const gap = Number.parseFloat(estilo.columnGap || estilo.gap || "0") || 0;
      const paso = primerItem.getBoundingClientRect().width + gap;
      const maximo = contenedor.scrollWidth - contenedor.clientWidth;
      if (paso <= 0 || maximo <= 0) {
        return;
      }

      const comportamiento = reduceMotion ? "auto" : "smooth";
      if (direccion === 1 && contenedor.scrollLeft + paso >= maximo - 2) {
        contenedor.scrollTo({ left: 0, behavior: comportamiento });
      } else if (direccion === -1 && contenedor.scrollLeft <= 2) {
        contenedor.scrollTo({ left: maximo, behavior: comportamiento });
      } else {
        contenedor.scrollBy({ left: paso * direccion, behavior: comportamiento });
      }
    },
    [reduceMotion],
  );

  useEffect(() => {
    if (itemCount < 2) {
      return;
    }

    const intervalo = window.setInterval(() => {
      if (!pausadoRef.current) {
        mover(1);
      }
    }, 1500);

    return () => window.clearInterval(intervalo);
  }, [itemCount, mover]);

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => {
        pausadoRef.current = true;
      }}
      onMouseLeave={() => {
        pausadoRef.current = false;
      }}
      onFocusCapture={() => {
        pausadoRef.current = true;
      }}
      onBlurCapture={() => {
        pausadoRef.current = false;
      }}
    >
      <div
        ref={contenedorRef}
        aria-label={ariaLabel}
        tabIndex={0}
        className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {itemCount > 1 ? (
        <>
          <button
            type="button"
            aria-label={`Ver anteriores de ${ariaLabel}`}
            onClick={() => mover(-1)}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-amber-300/40 bg-slate-950/90 p-2 text-amber-100 shadow-lg transition hover:bg-red-600 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Ver siguientes de ${ariaLabel}`}
            onClick={() => mover(1)}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-amber-300/40 bg-slate-950/90 p-2 text-amber-100 shadow-lg transition hover:bg-red-600 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      ) : null}
    </div>
  );
}

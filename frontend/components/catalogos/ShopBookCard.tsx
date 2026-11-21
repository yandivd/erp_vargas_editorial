"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Gift, Heart, ShoppingBag } from "lucide-react";
import BookImage from "@/components/libros/BookImage";
import type { LibroPublico } from "@/lib/catalogos";
import { money } from "@/lib/format";

type ShopBookCardProps = {
  libro: LibroPublico;
  favorito: boolean;
  onToggleFavorito: (libro: LibroPublico) => void;
  onClick?: (libro: LibroPublico) => void;
  href?: string;
};

export default function ShopBookCard({
  libro,
  favorito,
  onToggleFavorito,
  onClick,
  href,
}: ShopBookCardProps) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const esRegalo = favorito || Boolean(libro.descuento);

  const targetHref = href ?? (onClick ? undefined : `/catalogo/${libro.id}`);
  const cardProps = {
    whileHover: reduceMotion ? undefined : { y: -7, scale: 1.02, rotate: -0.4 },
    whileTap: reduceMotion ? undefined : { scale: 0.98 },
    transition: { type: "spring" as const, stiffness: 320, damping: 18 },
    className:
      "group relative flex cursor-pointer flex-col rounded-2xl border-2 border-red-500/70 bg-gradient-to-br from-white via-rose-50 to-emerald-50 p-5 text-left shadow-[0_18px_45px_-22px_rgba(0,0,0,0.85)] transition-shadow hover:shadow-[0_24px_60px_-20px_rgba(220,38,38,0.45)] focus:outline-none focus:ring-2 focus:ring-amber-300/70",
  };

  const content = (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl"
      >
        <div className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-gradient-to-b from-red-700 via-red-500 to-red-700 opacity-15" />
        <div className="absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700 opacity-15" />
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 64 40"
        className="absolute left-1/2 top-0 z-20 h-10 w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_4px_6px_rgba(0,0,0,0.25)]"
      >
        <path d="M32 24C18 10 4 12 8 24c3 9 16 8 24 0Z" fill="#b91c1c" stroke="#fbbf24" strokeWidth="2" />
        <path d="M32 24C46 10 60 12 56 24c-3 9-16 8-24 0Z" fill="#b91c1c" stroke="#fbbf24" strokeWidth="2" />
        <circle cx="32" cy="24" r="5" fill="#fbbf24" stroke="#fef3c7" strokeWidth="1.5" />
      </svg>

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleFavorito(libro);
        }}
        className="pointer-events-auto absolute right-3 top-3 z-30 rounded-full bg-white/90 p-2 text-slate-400 shadow-sm ring-1 ring-amber-200/70 transition hover:text-red-500"
        aria-label={favorito ? "Quitar de favoritos" : "Añadir a favoritos"}
        aria-pressed={favorito}
      >
        {esRegalo ? (
          <Gift className={`h-4 w-4 ${favorito ? "fill-red-500 text-red-500" : "text-emerald-600"}`} aria-hidden="true" />
        ) : (
          <>
            <Heart className="h-4 w-4 text-slate-400 transition group-hover:hidden" aria-hidden="true" />
            <Gift className="hidden h-4 w-4 text-red-500 group-hover:block" aria-hidden="true" />
          </>
        )}
      </button>

      <div className="pointer-events-none relative z-0 flex flex-col">
        <BookImage
          libro={libro}
          className="mb-4 aspect-[3/4] w-full rounded-lg ring-1 ring-red-200/60"
          imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div className="mt-auto flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-ink">{libro.titulo}</h3>
              <p className="truncate text-sm text-muted">{libro.autor || "Autor desconocido"}</p>
            </div>
            {!libro.disponible ? (
              <span className="shrink-0 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                Agotado
              </span>
            ) : null}
          </div>

          {libro.descripcion ? <p className="mt-2 line-clamp-2 text-sm text-muted">{libro.descripcion}</p> : null}

          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <span className="text-lg font-bold text-red-700">{money(libro.precio, "CUP")}</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              Ver detalle
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <motion.article
      role="button"
      tabIndex={0}
      onClick={() => {
        if (onClick) {
          onClick(libro);
          return;
        }
        if (targetHref) router.push(targetHref);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (onClick) {
            onClick(libro);
            return;
          }
          if (targetHref) router.push(targetHref);
        }
      }}
      {...cardProps}
    >
      {targetHref ? (
        <Link href={targetHref} className="absolute inset-0 z-10 rounded-2xl" aria-label={`Ver detalle de ${libro.titulo}`}>
          <span className="sr-only">Ver detalle</span>
        </Link>
      ) : null}
      {content}
    </motion.article>
  );
}

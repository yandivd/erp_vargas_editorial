"use client";

import { Heart, ShoppingBag } from "lucide-react";
import type { LibroPublico } from "@/lib/catalogos";
import { money } from "@/lib/format";
import { libroImagenSrc } from "@/lib/libros";

type ShopBookCardProps = {
  libro: LibroPublico;
  favorito: boolean;
  onToggleFavorito: (libro: LibroPublico) => void;
  onClick: (libro: LibroPublico) => void;
};

export default function ShopBookCard({
  libro,
  favorito,
  onToggleFavorito,
  onClick,
}: ShopBookCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick(libro)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(libro);
        }
      }}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/30"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorito(libro);
        }}
        className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-400 shadow-sm transition hover:text-red-500"
        aria-label={
          favorito ? "Quitar de favoritos" : "Añadir a favoritos"
        }
        aria-pressed={favorito}
      >
        <Heart
          className={`h-4 w-4 ${favorito ? "fill-red-500 text-red-500" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div className="mb-4 aspect-[21/9] overflow-hidden rounded-lg bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={libroImagenSrc(libro.imagen)}
          alt={`Portada de ${libro.titulo}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-ink">
            {libro.titulo}
          </h3>
          <p className="truncate text-sm text-muted">
            {libro.autor || "Autor desconocido"}
          </p>
        </div>
        {!libro.disponible ? (
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
            Agotado
          </span>
        ) : null}
      </div>

      {libro.descripcion ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted">
          {libro.descripcion}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="text-lg font-bold text-brand">
          {money(libro.precio, "CUP")}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          Ver detalle
        </span>
      </div>
    </article>
  );
}

"use client";

import type { RefObject } from "react";
import { Loader2, Search } from "lucide-react";
import type { LibroPublico } from "@/lib/catalogos";
import ShopBookCard from "./ShopBookCard";

type BookCatalogProps = {
  books: LibroPublico[];
  query: string;
  onQueryChange: (value: string) => void;
  error?: string | null;
  loadingInitial: boolean;
  loadingMore: boolean;
  hasNext: boolean;
  onRetry: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onBookClick?: (book: LibroPublico) => void;
  favoritos: Set<number>;
  onToggleFavorito: (book: LibroPublico) => void;
};

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-white/10 bg-slate-900/60 p-5"
        >
          <div className="mb-4 aspect-[3/4] w-full rounded-lg bg-slate-800" />
          <div className="h-5 w-2/3 rounded bg-slate-800" />
          <div className="mt-2 h-4 w-1/2 rounded bg-slate-800" />
          <div className="mt-4 h-4 w-full rounded bg-slate-800" />
          <div className="mt-6 h-5 w-1/3 rounded bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export default function BookCatalog({
  books,
  query,
  onQueryChange,
  error,
  loadingInitial,
  loadingMore,
  hasNext,
  onRetry,
  sentinelRef,
  onBookClick,
  favoritos,
  onToggleFavorito,
}: BookCatalogProps) {
  const hasBooks = books.length > 0;
  const normalizedQuery = query.trim();

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-amber-100">
            Libros publicados
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Explora el catálogo y descubre nuevas lecturas.
          </p>
        </div>
        <div className="relative w-full sm:max-w-md">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar por título o autor"
            className="w-full rounded-lg border border-white/10 bg-slate-950/60 py-2 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20"
            aria-label="Buscar por título o autor"
          />
        </div>
      </div>

      {error && !hasBooks ? (
        <div className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-8 text-center text-sm text-red-200">
          <p className="font-semibold">No se pudo cargar el catálogo.</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md border border-red-400/40 bg-red-900/40 px-4 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/60"
          >
            Reintentar
          </button>
        </div>
      ) : loadingInitial && !hasBooks ? (
        <SkeletonGrid />
      ) : !hasBooks ? (
        <div className="px-4 py-12 text-center text-sm text-slate-400">
          <p className="font-semibold text-slate-200">
            {normalizedQuery
              ? "No encontramos libros."
              : "No hay libros publicados."}
          </p>
          <p className="mt-1">
            {normalizedQuery
              ? "Prueba con otro título o autor."
              : "Vuelve más tarde para ver el catálogo."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {books.map((book) => (
              <ShopBookCard
                key={book.id}
                libro={book}
                favorito={favoritos.has(book.id)}
                onToggleFavorito={onToggleFavorito}
                onClick={onBookClick}
                href={onBookClick ? undefined : `/catalogo/${book.id}`}
              />
            ))}
          </div>

          {error ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-red-400/30 bg-red-950/40 px-4 py-5 text-center text-sm text-red-200">
              <p>{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-red-400/40 bg-red-900/40 px-4 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/60"
              >
                Reintentar
              </button>
            </div>
          ) : null}

          {loadingMore ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-slate-400"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando más libros...
            </div>
          ) : null}

          {!loadingMore && !error && !hasNext ? (
            <p className="mt-6 text-center text-xs text-slate-500">
              No hay más libros por mostrar.
            </p>
          ) : null}

          {hasNext ? (
            <div
              ref={sentinelRef}
              className="h-1 w-full"
              aria-hidden="true"
            />
          ) : null}
        </>
      )}
    </section>
  );
}

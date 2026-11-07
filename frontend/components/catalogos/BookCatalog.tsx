import type { RefObject } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import { money } from "@/lib/format";
import type { LibroPublico } from "@/lib/catalogos";

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
};

function SkeletonGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-xl border border-line p-5"
        >
          <div className="mb-4 h-36 rounded-lg bg-slate-100" />
          <div className="h-5 w-2/3 rounded bg-slate-100" />
          <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
          <div className="mt-4 h-4 w-full rounded bg-slate-100" />
          <div className="mt-6 h-5 w-1/3 rounded bg-slate-100" />
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
}: BookCatalogProps) {
  const hasBooks = books.length > 0;
  const normalizedQuery = query.trim();

  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-ink">
            Libros publicados
          </h2>
          <p className="mt-1 text-sm text-muted">
            Explora el catálogo y descubre nuevas lecturas.
          </p>
        </div>
        <div className="relative w-full sm:max-w-md">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar por título o autor"
            className="w-full rounded-lg border border-line bg-white py-2 pl-10 pr-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            aria-label="Buscar por título o autor"
          />
        </div>
      </div>

      {error && !hasBooks ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-800">
          <p className="font-semibold">No se pudo cargar el catálogo.</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      ) : loadingInitial && !hasBooks ? (
        <SkeletonGrid />
      ) : !hasBooks ? (
        <div className="px-4 py-12 text-center text-sm text-muted">
          <p className="font-semibold text-ink">
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <article
                key={book.id}
                className="flex flex-col rounded-xl border border-line p-5 transition hover:bg-slate-50"
              >
                <div className="mb-4 flex h-36 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <BookOpen className="h-10 w-10" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-ink">{book.titulo}</h3>
                <p className="text-sm text-muted">
                  {book.autor || "Autor desconocido"}
                </p>
                {book.descripcion ? (
                  <p className="mt-2 text-sm text-muted">{book.descripcion}</p>
                ) : null}
                <div className="mt-auto pt-4 text-lg font-bold text-brand">
                  {money(book.precio, "CUP")}
                </div>
              </article>
            ))}
          </div>

          {error ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-5 text-center text-sm text-red-800">
              <p>{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
              >
                Reintentar
              </button>
            </div>
          ) : null}

          {loadingMore ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-muted"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando más libros...
            </div>
          ) : null}

          {!loadingMore && !error && !hasNext ? (
            <p className="mt-6 text-center text-xs text-muted">
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

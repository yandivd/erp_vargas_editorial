"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { money } from "@/lib/format";
import type { LibroPublico } from "@/lib/catalogos";

type BookCatalogProps = {
  books: LibroPublico[];
  error?: string | null;
};

export default function BookCatalog({ books, error }: BookCatalogProps) {
  const [query, setQuery] = useState("");

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return books;
    }

    return books.filter((book) => {
      const titulo = book.titulo?.toLowerCase() ?? "";
      const autor = book.autor?.toLowerCase() ?? "";

      return (
        titulo.includes(normalizedQuery) || autor.includes(normalizedQuery)
      );
    });
  }, [books, query]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-800">
        <p className="font-semibold">No se pudo cargar el catálogo.</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white px-4 py-12 text-center text-sm text-muted">
        <p className="font-semibold text-ink">No hay libros publicados.</p>
        <p className="mt-1">Vuelve más tarde para ver el catálogo.</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-extrabold text-ink">
          Catálogo público
        </h2>
        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título o autor"
            className="w-full rounded-lg border border-line bg-white pl-10 pr-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            aria-label="Buscar por título o autor"
          />
        </div>
      </div>

      {filteredBooks.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted">
          <p className="font-semibold text-ink">No encontramos libros.</p>
          <p className="mt-1">Prueba con otro título o autor.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBooks.map((book) => (
            <article
              key={book.id}
              className="flex flex-col rounded-xl border border-line p-5 transition hover:bg-slate-50"
            >
              <div className="mb-4 flex h-36 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <BookOpen className="h-10 w-10" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-ink">{book.titulo}</h3>
              <p className="text-sm text-muted">{book.autor || "Autor desconocido"}</p>
              {book.descripcion ? (
                <p className="mt-2 text-sm text-muted">{book.descripcion}</p>
              ) : null}
              <div className="mt-auto pt-4 text-lg font-bold text-brand">
                {money(book.precio, "CUP")}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

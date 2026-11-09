"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type InventarioFiltersProps = {
  initialSearch: string;
};

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function InventarioFilters({
  initialSearch,
}: InventarioFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();

  function applyFilters(nextSearch: string) {
    const params = new URLSearchParams();

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(search);
  }

  function handleClear() {
    setSearch("");
    applyFilters("");
  }

  const hasFilters = Boolean(initialSearch);

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="inventario-search"
            className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted"
          >
            Buscar material
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="inventario-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre..."
              className={`${inputClass} w-full py-2 pl-9 pr-3`}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {isPending ? "Buscando..." : "Filtrar"}
          </button>
          {hasFilters || search ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Limpiar
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

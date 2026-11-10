"use client";

import { Filter, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { CategoriaCaja } from "@/lib/finanzas";

type CajaFiltersProps = {
  initialDesde: string;
  initialHasta: string;
  initialCategoria: string;
  categorias: CategoriaCaja[];
};

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelClass =
  "mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted";

export default function CajaFilters({
  initialDesde,
  initialHasta,
  initialCategoria,
  categorias,
}: CajaFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [desde, setDesde] = useState(initialDesde);
  const [hasta, setHasta] = useState(initialHasta);
  const [categoria, setCategoria] = useState(initialCategoria);
  const [isPending, startTransition] = useTransition();

  function applyFilters(
    nextDesde: string,
    nextHasta: string,
    nextCategoria: string,
  ) {
    const params = new URLSearchParams();

    if (nextDesde) {
      params.set("desde", nextDesde);
    }
    if (nextHasta) {
      params.set("hasta", nextHasta);
    }
    if (nextCategoria) {
      params.set("categoria", nextCategoria);
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(desde, hasta, categoria);
  }

  function handleClear() {
    setDesde("");
    setHasta("");
    setCategoria("");
    applyFilters("", "", "");
  }

  const hasFilters = Boolean(
    initialDesde || initialHasta || initialCategoria,
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
        <div>
          <label htmlFor="caja-desde" className={labelClass}>
            Desde
          </label>
          <input
            id="caja-desde"
            type="date"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="caja-hasta" className={labelClass}>
            Hasta
          </label>
          <input
            id="caja-hasta"
            type="date"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="caja-categoria-filtro" className={labelClass}>
            Categoría
          </label>
          <div className="relative">
            <Filter
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <select
              id="caja-categoria-filtro"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
              className={`${inputClass} appearance-none pl-9 pr-8`}
            >
              <option value="">Todas</option>
              {categorias.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {isPending ? "Filtrando..." : "Filtrar"}
          </button>
          {hasFilters || desde || hasta || categoria ? (
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

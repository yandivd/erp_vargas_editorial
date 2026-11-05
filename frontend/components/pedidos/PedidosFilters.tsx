"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import type { EstadoPedido } from "@/lib/pedidos";

type PedidosFiltersProps = {
  estados: EstadoPedido[];
  initialSearch: string;
  initialEstado: string;
  enTaller: boolean;
};

export default function PedidosFilters({
  estados,
  initialSearch,
  initialEstado,
  enTaller,
}: PedidosFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialSearch);
  const [estado, setEstado] = useState(initialEstado);
  const [isPending, startTransition] = useTransition();

  const estadosVisibles = enTaller
    ? estados.filter(
        (item) => item.es_taller || String(item.id) === initialEstado,
      )
    : estados;

  function applyFilters(nextSearch: string, nextEstado: string) {
    const params = new URLSearchParams();

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    }
    if (nextEstado) {
      params.set("estado", nextEstado);
    }
    params.set("en_taller", enTaller ? "true" : "false");

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(search, estado);
  }

  function handleClear() {
    setSearch("");
    setEstado("");
    applyFilters("", "");
  }

  const hasFilters = Boolean(initialSearch || initialEstado);

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="pedido-search"
            className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted"
          >
            Buscar pedido
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="pedido-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ID, cliente, libro, autor o referencia..."
              className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        <div className="w-full lg:w-64">
          <label
            htmlFor="pedido-estado"
            className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted"
          >
            Estado
          </label>
          <div className="relative">
            <SlidersHorizontal
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <select
              id="pedido-estado"
              value={estado}
              onChange={(event) => setEstado(event.target.value)}
              className="w-full appearance-none rounded-lg border border-line bg-white py-2 pl-9 pr-8 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">
                {enTaller ? "Todos los estados del taller" : "Todos los estados"}
              </option>
              {estadosVisibles.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nombre}
                </option>
              ))}
            </select>
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
          {hasFilters || search || estado ? (
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

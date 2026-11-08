"use client";

import { Filter, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type ClientesFiltersProps = {
  initialNombre: string;
  initialTelefono: string;
  initialDeuda: string;
};

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelClass =
  "mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted";

export default function ClientesFilters({
  initialNombre,
  initialTelefono,
  initialDeuda,
}: ClientesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [nombre, setNombre] = useState(initialNombre);
  const [telefono, setTelefono] = useState(initialTelefono);
  const [deuda, setDeuda] = useState(initialDeuda);
  const [isPending, startTransition] = useTransition();

  function applyFilters(
    nextNombre: string,
    nextTelefono: string,
    nextDeuda: string,
  ) {
    const params = new URLSearchParams();

    if (nextNombre.trim()) {
      params.set("nombre", nextNombre.trim());
    }
    if (nextTelefono.trim()) {
      params.set("telefono", nextTelefono.trim());
    }
    if (nextDeuda) {
      params.set("deuda", nextDeuda);
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(nombre, telefono, deuda);
  }

  function handleClear() {
    setNombre("");
    setTelefono("");
    setDeuda("");
    applyFilters("", "", "");
  }

  const hasFilters = Boolean(
    initialNombre || initialTelefono || initialDeuda,
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
        <div>
          <label htmlFor="cliente-nombre" className={labelClass}>
            Nombre
          </label>
          <input
            id="cliente-nombre"
            type="search"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Buscar nombre..."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="cliente-telefono" className={labelClass}>
            Teléfono
          </label>
          <input
            id="cliente-telefono"
            type="search"
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
            placeholder="Buscar teléfono..."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="cliente-deuda" className={labelClass}>
            Deuda
          </label>
          <div className="relative">
            <Filter
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <select
              id="cliente-deuda"
              value={deuda}
              onChange={(event) => setDeuda(event.target.value)}
              className={`${inputClass} appearance-none pl-9 pr-8`}
            >
              <option value="">Todos</option>
              <option value="con_deuda">Con deuda</option>
              <option value="al_dia">Al día</option>
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
          {hasFilters || nombre || telefono || deuda ? (
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

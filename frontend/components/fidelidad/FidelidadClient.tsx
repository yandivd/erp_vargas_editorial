"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Gift,
  SearchX,
} from "lucide-react";
import TableControls from "@/components/ui/TableControls";
import { useTable } from "@/lib/useTable";
import { integer, money } from "@/lib/format";
import type { ClienteListItem, FidelidadCliente } from "@/lib/clientes";

type Cliente = ClienteListItem & {
  tarjeta_fidelidad?: Partial<FidelidadCliente> | null;
};
type SortKey = "sellos" | "bono";
type SortDir = "asc" | "desc";

function tarjeta(c: Cliente): Partial<FidelidadCliente> {
  return c.fidelidad ?? c.tarjeta_fidelidad ?? {};
}

function SortHeader({
  column,
  label,
  active,
  dir,
  onSort,
}: {
  column: SortKey;
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: (column: SortKey) => void;
}) {
  return (
    <th className="py-3 pr-3">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 font-medium hover:text-ink"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </button>
    </th>
  );
}

export default function FidelidadClient({
  initialClientes,
}: {
  initialClientes: Cliente[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("sellos");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const clientes = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    return [...initialClientes].sort((a, b) => {
      const va =
        sortKey === "sellos"
          ? Number(tarjeta(a).sellos ?? 0)
          : Number(tarjeta(a).bono_saldo ?? 0);
      const vb =
        sortKey === "sellos"
          ? Number(tarjeta(b).sellos ?? 0)
          : Number(tarjeta(b).bono_saldo ?? 0);
      return (va - vb) * factor || a.nombre.localeCompare(b.nombre);
    });
  }, [initialClientes, sortKey, sortDir]);

  const t = useTable(clientes, {
    searchKeys: (c) => [
      c.nombre,
      c.telefono || "",
      String(tarjeta(c).sellos ?? ""),
    ],
    filters: {
      tiene_bono: (c, v) =>
        v === "si"
          ? Number(tarjeta(c).bono_saldo || 0) > 0
          : v === "no"
            ? Number(tarjeta(c).bono_saldo || 0) <= 0
            : true,
    },
  });

  function alternarOrden(column: SortKey) {
    if (column === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column);
      setSortDir("desc");
    }
    t.setPage(1);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
          <Gift className="h-7 w-7 text-brand" />
          Fidelidad
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tarjetas, sellos y bonos de clientes.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls
          total={t.total}
          search={t.search}
          onSearch={t.setSearch}
          filters={t.filters}
          onFilter={t.setFilter}
          filterDefs={[
            {
              key: "tiene_bono",
              label: "Bono",
              options: [
                { value: "si", label: "Con bono" },
                { value: "no", label: "Sin bono" },
              ],
            },
          ]}
        />

        {t.pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
            <SearchX className="mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-ink">No hay clientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-slate-500">
                  <th className="py-3 pr-3">Cliente</th>
                  <th className="py-3 pr-3">Teléfono</th>
                  <SortHeader
                    column="sellos"
                    label="Sellos"
                    active={sortKey === "sellos"}
                    dir={sortDir}
                    onSort={alternarOrden}
                  />
                  <SortHeader
                    column="bono"
                    label="Bono"
                    active={sortKey === "bono"}
                    dir={sortDir}
                    onSort={alternarOrden}
                  />
                  <th className="py-3 pr-0">Token</th>
                </tr>
              </thead>
              <tbody>
                {t.pageRows.map((c) => {
                  const f = tarjeta(c);
                  return (
                    <tr key={c.id} className="border-b border-line/70">
                      <td className="py-3 pr-3 font-medium text-ink">
                        <Link
                          href={`/clientes/${c.id}`}
                          className="hover:text-brand hover:underline"
                        >
                          {c.nombre}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-muted">
                        {c.telefono || "-"}
                      </td>
                      <td className="py-3 pr-3">{integer(f.sellos ?? 0)}</td>
                      <td className="py-3 pr-3">
                        {money(f.bono_saldo ?? 0)}
                      </td>
                      <td className="py-3 pr-0 text-xs text-muted">
                        {f.token || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>
            {t.totalPages > 1
              ? `${t.start}-${t.end} de ${t.total}`
              : `${t.total} resultado${t.total === 1 ? "" : "s"}`}
          </span>
          {t.totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={t.page <= 1}
                onClick={() => t.setPage(t.page - 1)}
                className="rounded-lg border border-line p-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                Pág. {t.page} / {t.totalPages}
              </span>
              <button
                type="button"
                disabled={t.page >= t.totalPages}
                onClick={() => t.setPage(t.page + 1)}
                className="rounded-lg border border-line p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

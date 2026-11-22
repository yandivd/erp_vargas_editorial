"use client";
import { SearchX, Gift } from "lucide-react";
import TableControls from "@/components/ui/TableControls";
import { useTable } from "@/lib/useTable";
import { money, integer } from "@/lib/format";

type Cliente = any;
export default function FidelidadClient({ initialClientes }: { initialClientes: Cliente[] }) {
  const t = useTable(initialClientes, {
    searchKeys: (c) => [c.nombre, c.telefono || "", String(c.tarjeta_fidelidad?.sellos ?? "")],
    filters: { tiene_bono: (c, v) => v === "si" ? Number(c.tarjeta_fidelidad?.bono_saldo || 0) > 0 : v === "no" ? Number(c.tarjeta_fidelidad?.bono_saldo || 0) <= 0 : true },
  });
  return (
    <div>
      <div className="mb-5"><h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink"><Gift className="h-7 w-7 text-brand" />Fidelidad</h1><p className="mt-1 text-sm text-muted">Tarjetas, sellos y bonos de clientes.</p></div>
      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls search={t.search} onSearch={t.setSearch} filters={t.filters} onFilter={t.setFilter} filterDefs={[{ key: "tiene_bono", label: "Bono", options: [{ value: "si", label: "Con bono" }, { value: "no", label: "Sin bono" }] }]} page={t.page} totalPages={t.totalPages} total={t.total} start={t.start} end={t.end} onPage={t.setPage} />
        {t.pageRows.length === 0 ? <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted"><SearchX className="mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-ink">No hay clientes</p></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b border-line text-left text-slate-500"><th className="py-3 pr-3">Cliente</th><th className="py-3 pr-3">Teléfono</th><th className="py-3 pr-3">Sellos</th><th className="py-3 pr-3">Bono</th><th className="py-3 pr-0">Token</th></tr></thead><tbody>
            {t.pageRows.map((c: any) => <tr key={c.id} className="border-b border-line/70"><td className="py-3 pr-3 font-medium text-ink">{c.nombre}</td><td className="py-3 pr-3 text-muted">{c.telefono || "-"}</td><td className="py-3 pr-3">{integer(c.tarjeta_fidelidad?.sellos ?? 0)}</td><td className="py-3 pr-3">{money(c.tarjeta_fidelidad?.bono_saldo ?? 0)}</td><td className="py-3 pr-0 text-xs text-muted">{c.tarjeta_fidelidad?.token || "-"}</td></tr>)}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}

"use client";
import { Package, SearchX } from "lucide-react";
import AjusteStockModal from "@/components/inventario/AjusteStockModal";
import HistorialModal from "@/components/inventario/HistorialModal";
import MovimientoModal from "@/components/inventario/MovimientoModal";
import SalidaRapidaModal from "@/components/inventario/SalidaRapidaModal";
import TableControls from "@/components/ui/TableControls";
import { useTable } from "@/lib/useTable";
import { number } from "@/lib/format";
import type { InventarioMaterial } from "@/lib/inventario";
import { tableClass, tableRowClass, tableWrapClass, tdClass, thClass } from "@/components/dashboard/ui";

export default function InventarioClient({ initialMateriales }: { initialMateriales: InventarioMaterial[] }) {
  const t = useTable(initialMateriales, {
    searchKeys: (m) => [m.nombre, m.unidad_medida],
    filters: { estado: (m, v) => v === "bajo" ? !!m.stock_bajo : v === "ok" ? !m.stock_bajo : true },
  });
  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink"><Package className="h-7 w-7 text-brand" />Inventario</h1><p className="mt-1 text-sm text-muted">Control de materiales, stocks y alertas de reposición.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted"><span className="font-bold text-ink">{t.total}</span> material{t.total === 1 ? "" : "es"}</div><MovimientoModal materiales={initialMateriales} /></div>
      </div>
      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls search={t.search} onSearch={t.setSearch} filters={t.filters} onFilter={t.setFilter}
          filterDefs={[{ key: "estado", label: "Estado", options: [{ value: "ok", label: "OK" }, { value: "bajo", label: "Stock bajo" }] }]}
          page={t.page} totalPages={t.totalPages} total={t.total} start={t.start} end={t.end} onPage={t.setPage} />
        {t.pageRows.length === 0 ? <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted"><SearchX className="mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-ink">No encontramos materiales</p></div> : (
          <div className={tableWrapClass}><table className={tableClass}><thead><tr><th className={thClass}>Material</th><th className={thClass}>Unidad</th><th className={`${thClass} text-right`}>Stock Actual</th><th className={`${thClass} text-right`}>Stock Mínimo</th><th className={thClass}>Estado</th><th className={`${thClass} text-right`}>Acciones</th></tr></thead>
            <tbody>{t.pageRows.map((m) => { const bajo = Boolean(m.stock_bajo); return (
              <tr key={m.id} className={tableRowClass}>
                <td className={tdClass}>{m.nombre}</td><td className={tdClass}>{m.unidad_medida}</td><td className={`${tdClass} text-right`}>{number(m.stock_actual)}</td><td className={`${tdClass} text-right`}>{number(m.stock_minimo)}</td>
                <td className={tdClass}><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${bajo ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{bajo ? "Stock bajo" : "OK"}</span></td>
                <td className={`${tdClass} text-right`}><div className="flex flex-wrap justify-end gap-2"><AjusteStockModal material={m} /><SalidaRapidaModal material={m} /><HistorialModal material={m} /></div></td>
              </tr>); })}</tbody></table></div>
        )}
      </section>
    </div>
  );
}

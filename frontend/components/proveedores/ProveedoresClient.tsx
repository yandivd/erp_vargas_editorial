"use client";
import { SearchX, Truck } from "lucide-react";
import NuevoProveedorModal from "@/components/proveedores/NuevoProveedorModal";
import ProveedoresTable from "@/components/proveedores/ProveedoresTable";
import TableControls from "@/components/ui/TableControls";
import { useTable } from "@/lib/useTable";
import type { Proveedor } from "@/lib/proveedores";

export default function ProveedoresClient({ initialProveedores }: { initialProveedores: Proveedor[] }) {
  const t = useTable(initialProveedores, {
    searchKeys: (p: any) => [p.nombre, p.contacto || "", p.telefono || "", p.direccion || ""],
    filters: { tiene_deuda: (p: any, v) => v === "si" ? Number(p.deuda_total ?? p.deuda ?? 0) > 0 : v === "no" ? Number(p.deuda_total ?? p.deuda ?? 0) <= 0 : true },
  });
  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink"><Truck className="h-7 w-7 text-brand" />Proveedores</h1>
          <p className="mt-1 text-sm text-muted">Directorio de proveedores, deudas y lotes de servicios externos.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted"><span className="font-bold text-ink">{t.total}</span> proveedor{t.total === 1 ? "" : "es"}</div>
          <NuevoProveedorModal />
        </div>
      </div>
      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls search={t.search} onSearch={t.setSearch} filters={t.filters} onFilter={t.setFilter}
          filterDefs={[{ key: "tiene_deuda", label: "Deuda", options: [{ value: "si", label: "Con deuda" }, { value: "no", label: "Al día" }] }]}
          page={t.page} totalPages={t.totalPages} total={t.total} start={t.start} end={t.end} onPage={t.setPage} />
        {t.pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted"><SearchX className="mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-ink">No hay proveedores</p></div>
        ) : <ProveedoresTable proveedores={t.pageRows} />}
      </section>
    </div>
  );
}

"use client";
import { SearchX, UserRound, AlertTriangle } from "lucide-react";
import EmpleadosTable from "@/components/empleados/EmpleadosTable";
import NuevoEmpleadoModal from "@/components/empleados/NuevoEmpleadoModal";
import PagoEmpleadoButton from "@/components/empleados/PagoEmpleadoButton";
import UtilidadesWidget from "@/components/empleados/UtilidadesWidget";
import TableControls from "@/components/ui/TableControls";
import { useTable } from "@/lib/useTable";
import type { Empleado, UtilidadesDisponibles } from "@/lib/empleados";

export default function EmpleadosClient({ initialEmpleados, utilidades, utilidadesError }: { initialEmpleados: Empleado[]; utilidades: UtilidadesDisponibles | null; utilidadesError: string | null }) {
  const t = useTable(initialEmpleados, {
    searchKeys: (e) => [e.nombre, e.cargo || "", e.telefono || ""],
    filters: { activo: (e, v) => v === "activo" ? !!e.activo : v === "inactivo" ? !e.activo : true },
  });
  const tasaActual = utilidades?.tasa_actual ?? 0;
  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink"><UserRound className="h-7 w-7 text-brand" />Nómina</h1>
          <p className="mt-1 text-sm text-muted">Empleados, salarios, historial de pagos y retiro de utilidades.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted"><span className="font-bold text-ink">{t.total}</span> empleado{t.total === 1 ? "" : "s"}</div>
          <PagoEmpleadoButton empleados={initialEmpleados} tasaActual={tasaActual} />
          <NuevoEmpleadoModal />
        </div>
      </div>
      {utilidades ? <UtilidadesWidget data={utilidades} /> : <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>No se pudieron calcular las utilidades disponibles{utilidadesError ? `: ${utilidadesError}` : "."}</span></div>}
      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls search={t.search} onSearch={t.setSearch} filters={t.filters} onFilter={t.setFilter}
          filterDefs={[{ key: "activo", label: "Estado", options: [{ value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }] }]}
          page={t.page} totalPages={t.totalPages} total={t.total} start={t.start} end={t.end} onPage={t.setPage} />
        {t.pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted"><SearchX className="mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-ink">No hay empleados</p></div>
        ) : <EmpleadosTable empleados={t.pageRows} tasaActual={tasaActual} />}
      </section>
    </div>
  );
}

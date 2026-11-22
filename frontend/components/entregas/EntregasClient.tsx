"use client";
import Link from "next/link";
import { Clock3, Eye, History, SearchX, Truck } from "lucide-react";
import { formatDate, money } from "@/lib/format";
import type { EntregaListItem } from "@/lib/entregas";
import { useTable } from "@/lib/useTable";
import TableControls from "@/components/ui/TableControls";
import { KpiCard, tableClass, tableRowClass, tableWrapClass, tdClass, thClass } from "@/components/dashboard/ui";

type Tab = "pendientes" | "historial";
const TABS: { key: Tab; label: string; icon: typeof Truck }[] = [{ key: "pendientes", label: "Pendientes", icon: Clock3 }, { key: "historial", label: "Historial", icon: History }];

export default function EntregasClient({ initialEntregas, tab }: { initialEntregas: EntregaListItem[]; tab: Tab }) {
  const t = useTable(initialEntregas, {
    searchKeys: (e) => [e.cliente_nombre, String(e.id), e.estado],
    filters: { estado: (e, v) => v === "entregado" ? !!e.entregado : v === "pendiente" ? !e.entregado : true },
  });
  const totalPorCobrar = t.pageRows.reduce((s, e) => s + Number(e.total_pendiente || 0), 0);
  const pedidos = t.pageRows.reduce((s, e) => s + (e.cantidad_pedidos || 0), 0);
  return (
    <div>
      <div className="mb-6 flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white"><Truck className="h-5 w-5" /></span><div><h1 className="text-xl font-extrabold text-ink md:text-2xl">Entregas</h1><p className="text-sm text-muted">Pedidos agrupados para despacho y cobro final</p></div></div>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><KpiCard label={tab === "pendientes" ? "Entregas pendientes" : "Entregas realizadas"} value={String(t.total)} tone="blue" /><KpiCard label="Pedidos incluidos" value={String(pedidos)} tone="cyan" /><KpiCard label="Total a cobrar" value={money(totalPorCobrar)} tone="emerald" /></div>
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{TABS.map(({ key, label, icon: Icon }) => <Link key={key} href={`/entregas?tab=${key}`} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === key ? "bg-navy-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}><Icon className="h-4 w-4" />{label}</Link>)}</div>
      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls search={t.search} onSearch={t.setSearch} filters={t.filters} onFilter={t.setFilter} filterDefs={[{ key: "estado", label: "Estado", options: [{ value: "pendiente", label: "Pendiente" }, { value: "entregado", label: "Entregado" }] }]} page={t.page} totalPages={t.totalPages} total={t.total} start={t.start} end={t.end} onPage={t.setPage} />
        {t.pageRows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><SearchX className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 text-base font-semibold text-slate-800">No hay entregas</h2></div> : (
          <div className={tableWrapClass}><div className="overflow-x-auto overscroll-x-contain"><table className={tableClass}><thead><tr><th className={thClass}>Cliente</th><th className={thClass}>Fecha</th><th className={thClass}>Pedidos</th><th className={thClass}>Total a cobrar</th><th className={thClass}>Estado</th><th className={`${thClass} text-right`}>Acciones</th></tr></thead><tbody>{t.pageRows.map((e) => (
            <tr key={e.id} className={tableRowClass}><td className={tdClass}><p className="font-medium text-slate-900">{e.cliente_nombre}</p><p className="text-xs text-slate-500">Entrega #{e.id}</p></td><td className={tdClass}>{formatDate(e.fecha_entrega || e.fecha_creacion)}</td><td className={tdClass}>{e.cantidad_pedidos}</td><td className={tdClass}><p className={e.entregado ? "font-semibold text-emerald-700" : "font-semibold text-slate-900"}>{money(e.total_pendiente)}</p><p className="text-xs text-slate-500">{e.entregado ? "Entregada" : `Saldo: ${money(e.saldo_pedidos)}`}</p></td><td className={tdClass}><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${e.entregado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{e.estado}</span></td><td className={`${tdClass} text-right`}><Link href={`/entregas/${e.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />Ver detalle</Link></td></tr>
          ))}</tbody></table></div></div>
        )}
      </section>
    </div>
  );
}

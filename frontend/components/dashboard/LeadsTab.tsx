import { Target, TrendingUp, Clock, Filter, BarChart3, Route } from "lucide-react";
import type { DashboardLeads } from "@/lib/dashboard";
import { integer } from "@/lib/format";
import { LeadsConversionViaChart, LeadsEmbudoChart, LeadsMensualChart, LeadsTendenciaDiariaChart } from "./charts";
import { KpiCard, SectionCard, tableClass, tableWrapClass, thClass, tdClass, tableRowClass, EmptyTableRow } from "./ui";

const estadoLabel: Record<string, string> = {
  nuevo: "Nuevo", contactado: "Contactado", interesado: "Interesado", convertido: "Convertido", perdido: "Perdido",
};
const viaLabel: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", telefono: "Teléfono", personal: "Personal", web: "Web", referido: "Referido", otro: "Otro",
};

export default function LeadsTab({ data }: { data: DashboardLeads }) {
  const { kpis, por_estado, por_via, recientes, tendencia, tendencia_mensual, conversion_por_via, embudo } = data;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-5">
        <KpiCard label="Total leads" value={integer(kpis.total)} sub={`Últimos 30 días: ${integer(kpis.ultimos_30)}`} tone="blue" />
        <KpiCard label="Convertidos" value={integer(kpis.convertidos)} sub={`Tasa: ${kpis.tasa_conversion}%`} tone="emerald" valueClassName="text-emerald-600" />
        <KpiCard label="Nuevos" value={integer(kpis.nuevos)} sub="Sin contactar" tone="amber" />
        <KpiCard label="Interesados" value={integer(kpis.interesados)} sub={`Contactados: ${integer(kpis.contactados)}`} tone="violet" />
        <KpiCard label="Este mes" value={integer(kpis.mes_total)} sub={`Convertidos: ${integer(kpis.mes_convertidos)}`} tone="cyan" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Embudo de conversión" icon={<Filter className="h-5 w-5 text-brand" />}>
          <div className="h-72"><LeadsEmbudoChart data={embudo} /></div>
        </SectionCard>
        <SectionCard title="Leads por mes" icon={<BarChart3 className="h-5 w-5 text-brand" />}>
          <div className="h-72"><LeadsMensualChart data={tendencia_mensual} /></div>
        </SectionCard>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Conversión por vía" icon={<Route className="h-5 w-5 text-brand" />}>
          <div className="h-72"><LeadsConversionViaChart data={conversion_por_via} /></div>
        </SectionCard>
        <SectionCard title="Tendencia diaria" icon={<TrendingUp className="h-5 w-5 text-brand" />}>
          <div className="h-72"><LeadsTendenciaDiariaChart data={tendencia} /></div>
        </SectionCard>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Por estado" icon={<Target className="h-5 w-5 text-brand" />}>
          <div className="space-y-2">
            {por_estado.map((e) => {
              const pct = kpis.total ? Math.round((e.total / kpis.total) * 100) : 0;
              return (
                <div key={e.estado}>
                  <div className="mb-1 flex justify-between text-xs text-slate-600"><span>{e.label}</span><span>{e.total} ({pct}%)</span></div>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </SectionCard>
        <SectionCard title="Por vía de contacto" icon={<TrendingUp className="h-5 w-5 text-brand" />}>
          <div className="space-y-2">
            {por_via.filter((v) => v.total > 0).map((v) => {
              const pct = kpis.total ? Math.round((v.total / kpis.total) * 100) : 0;
              return (
                <div key={v.via}>
                  <div className="mb-1 flex justify-between text-xs text-slate-600"><span>{v.label}</span><span>{v.total} ({pct}%)</span></div>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
            {por_via.every((v) => v.total === 0) ? <div className="text-sm text-slate-500">Sin datos.</div> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Leads recientes" icon={<Clock className="h-5 w-5 text-brand" />}>
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead><tr><th className={thClass}>Nombre/Teléfono</th><th className={thClass}>Vía</th><th className={thClass}>Estado</th><th className={thClass}>Interés</th><th className={thClass}>Cliente</th></tr></thead>
            <tbody>
              {recientes.length === 0 ? <EmptyTableRow colSpan={5}>No hay leads en el período.</EmptyTableRow> : recientes.map((l) => (
                <tr key={l.id} className={tableRowClass}>
                  <td className={tdClass}><div className="font-medium">{l.nombre || l.telefono || `#${l.id}`}</div>{l.nombre && l.telefono ? <div className="text-xs text-slate-500">{l.telefono}</div> : null}</td>
                  <td className={tdClass}>{viaLabel[l.via_contacto] || l.via_contacto}</td>
                  <td className={tdClass}>{estadoLabel[l.estado] || l.estado}</td>
                  <td className={tdClass}>{l.interes || "-"}</td>
                  <td className={tdClass}>{l.cliente_nombre || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

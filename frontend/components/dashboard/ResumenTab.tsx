import {
  BarChart3,
  Boxes,
  Grid3X3,
  Lightbulb,
  List,
  PieChart,
  TrendingUp,
} from "lucide-react";
import type { DashboardResumen } from "@/lib/dashboard";
import { integer, money, number } from "@/lib/format";
import {
  IncomeBreakdownChart,
  ProjectionChart,
  TrendChart,
  WeeklyChart,
} from "./charts";
import {
  adviceTones,
  EmptyTableRow,
  KpiCard,
  SectionCard,
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
  TypeBadge,
} from "./ui";

export default function ResumenTab({ data }: { data: DashboardResumen }) {
  const { kpis, meta } = data;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <KpiCard
          label="Ingresos netos CUP"
          value={money(kpis.ingresos_cup)}
          sub={
            <>
              <div>
                Bruto: {money(kpis.ingresos_brutos_cup)} · Vuelto:{" "}
                {money(kpis.vuelto_clientes_cup)}
              </div>
              <div>USD neto: {money(kpis.ingresos_usd, "USD")}</div>
            </>
          }
          tone="emerald"
          valueClassName="text-emerald-600"
        />
        <KpiCard
          label="Gastos totales CUP"
          value={money(kpis.gastos_totales_cup)}
          sub={
            <>
              <div>
                Reales CUP: {money(kpis.gastos_cup)} · USD:{" "}
                {money(kpis.gastos_usd, "USD")}
              </div>
              <div>
                Depreciación de Activos:{" "}
                {money(kpis.depreciacion_activos_cup)}
              </div>
            </>
          }
          tone="red"
          valueClassName="text-red-500"
        />
        <KpiCard
          label="Saldo operativo CUP"
          value={money(kpis.saldo_neto_cup)}
          sub={`USD: ${money(kpis.saldo_neto_usd, "USD")}`}
          tone="blue"
          valueClassName="text-brand"
        />
        <KpiCard
          label="Margen neto con depreciación"
          value={`${Number(kpis.margen ?? 0).toFixed(1)}%`}
          sub={
            <>
              <div>Operativo: {Number(kpis.margen_operativo ?? 0).toFixed(1)}%</div>
              <div>Flujo caja: {money(kpis.flujo_neto_cup)}</div>
            </>
          }
          tone="amber"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <KpiCard
          label="Pedidos"
          value={integer(kpis.total_pedidos)}
          sub="Desde el corte"
          tone="violet"
        />
        <KpiCard
          label="Clientes"
          value={integer(kpis.clientes_unicos)}
          sub="Con pedidos desde el corte"
          tone="cyan"
        />
        <KpiCard
          label="Ventas"
          value={money(kpis.ventas)}
          sub="Precio de venta"
          tone="pink"
        />
        <KpiCard
          label="Ganancia promedio / pedido"
          value={money(kpis.ganancia_promedio_cup)}
          sub={money(kpis.ganancia_promedio_usd, "USD")}
          tone="orange"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <KpiCard label="Saldo caja CUP" value={money(kpis.saldo_caja_cup)} />
        <KpiCard label="Saldo caja USD" value={money(kpis.saldo_caja_usd, "USD")} />
        <KpiCard
          label="Total equivalente CUP"
          value={money(kpis.saldo_caja_equiv_cup)}
          sub={`Tasa: ${number(meta?.tasa_cambio ?? 0)}`}
        />
        <KpiCard
          label="Pasivos activos"
          value={money(kpis.pasivos_cup)}
          sub={`Anticipos ${money(kpis.anticipos_cup)} + servicios ${money(kpis.servicios_impagos_cup)}`}
          valueClassName="text-amber-500"
        />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <SectionCard
          title="Desglose bruto por Tipo de Ingreso"
          icon={<PieChart className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
        >
          <div className="h-[180px] w-full md:h-[220px]">
            <IncomeBreakdownChart data={data.desglose_ingresos} />
          </div>
        </SectionCard>

        <SectionCard
          title="Categorías de Ingreso"
          icon={<BarChart3 className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Categoría</th>
                  <th className={`${thClass} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.desglose_ingresos.length ? (
                  data.desglose_ingresos.map((item) => (
                    <tr key={item.categoria} className={tableRowClass}>
                      <td className={tdClass}>{item.categoria}</td>
                      <td className={`${tdClass} text-right`}>{money(item.total)}</td>
                    </tr>
                  ))
                ) : (
                  <EmptyTableRow colSpan={2}>Sin ingresos operativos</EmptyTableRow>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Los cobros se muestran brutos. El ingreso neto descuenta{" "}
            {money(kpis.vuelto_clientes_cup)} de vueltos:{" "}
            <strong>{money(kpis.ingresos_cup)}</strong>.
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="Costo Unitario por Material"
        icon={<Boxes className="h-5 w-5 text-amber-500" aria-hidden="true" />}
      >
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Material</th>
                <th className={`${thClass} hidden text-right md:table-cell`}>
                  Cantidad
                </th>
                <th className={`${thClass} text-right`}>Costo Total</th>
                <th className={`${thClass} hidden text-right md:table-cell`}>
                  Costo Unit.
                </th>
              </tr>
            </thead>
            <tbody>
              {data.costo_unitario.length ? (
                data.costo_unitario.map((item) => (
                  <tr key={item.material} className={tableRowClass}>
                    <td className={tdClass}>
                      {item.material}
                      <div className="text-xs text-muted">{item.unidad || ""}</div>
                    </td>
                    <td className={`${tdClass} hidden text-right md:table-cell`}>
                      {number(item.cantidad)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {money(item.costo_total)}
                    </td>
                    <td className={`${tdClass} hidden text-right md:table-cell`}>
                      {money(item.costo_unitario)}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyTableRow colSpan={4}>Sin consumos de inventario</EmptyTableRow>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mb-4 grid gap-3 md:grid-cols-7">
        <SectionCard
          className="md:col-span-4"
          title="Tendencia Mensual"
          icon={<TrendingUp className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <div className="h-[220px] w-full md:h-[280px]">
            <TrendChart data={data.tendencia} />
          </div>
        </SectionCard>

        <SectionCard
          className="md:col-span-3"
          title="Proyección"
          icon={<TrendingUp className="h-5 w-5 text-cyan-600" aria-hidden="true" />}
        >
          <div className="h-[220px] w-full md:h-[280px]">
            <ProjectionChart data={data.proyeccion} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Ingresos vs Gastos por Semana"
        icon={<BarChart3 className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
      >
        <div className="h-[220px] w-full md:h-[280px]">
          <WeeklyChart data={data.semanal} />
        </div>
      </SectionCard>

      <SectionCard
        title="Mapa de Calor (día × hora)"
        icon={<Grid3X3 className="h-5 w-5 text-red-500" aria-hidden="true" />}
      >
        <div className={tableWrapClass}>
          <table className="w-full border-collapse text-nowrap text-sm">
            <thead>
              <tr>
                <th className="border border-line p-2" />
                {data.calor.horas.map((hora) => (
                  <th key={hora} className="border border-line p-2 text-center text-xs">
                    {hora}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.calor.filas.map((fila) => (
                <tr key={fila.dia}>
                  <th className="border border-line p-2 text-left text-xs">
                    {fila.dia}
                  </th>
                  {fila.valores.map((valor, index) => {
                    const alpha = data.calor.max
                      ? Math.max(0.05, valor / data.calor.max)
                      : 0.05;

                    return (
                      <td
                        key={`${fila.dia}-${index}`}
                        className="border border-line p-2 text-center"
                      >
                        <span
                          className="inline-block h-7 w-7 min-w-7 rounded"
                          title={`${valor} movimientos`}
                          style={{ backgroundColor: `rgba(59,130,246,${alpha})` }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Últimas Transacciones"
        icon={<List className="h-5 w-5 text-slate-500" aria-hidden="true" />}
      >
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Tipo</th>
                <th className={`${thClass} hidden md:table-cell`}>Concepto</th>
                <th className={`${thClass} text-right`}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.transacciones.length ? (
                data.transacciones.map((item, index) => (
                  <tr key={`${item.fecha}-${index}`} className={tableRowClass}>
                    <td className={`${tdClass} whitespace-nowrap`}>{item.fecha}</td>
                    <td className={tdClass}>
                      <TypeBadge type={item.tipo} />
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      {item.concepto}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      {money(item.monto, item.moneda)}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyTableRow colSpan={4}>Sin transacciones</EmptyTableRow>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Análisis por Categoría"
        icon={<BarChart3 className="h-5 w-5 text-slate-700" aria-hidden="true" />}
      >
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Categoría</th>
                <th className={`${thClass} hidden md:table-cell`}>Tipo</th>
                <th className={`${thClass} hidden text-right md:table-cell`}>Cant.</th>
                <th className={`${thClass} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.analisis_categorias.length ? (
                data.analisis_categorias.map((item, index) => (
                  <tr key={`${item.categoria}-${index}`} className={tableRowClass}>
                    <td className={tdClass}>{item.categoria}</td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      <TypeBadge type={item.tipo} />
                    </td>
                    <td className={`${tdClass} hidden text-right md:table-cell`}>
                      {integer(item.cantidad)}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      {money(item.total, item.moneda)}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyTableRow colSpan={4}>Sin movimientos</EmptyTableRow>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Consejos Personalizados"
        icon={<Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />}
      >
        {data.consejos.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.consejos.map((consejo, index) => (
              <div
                key={`${consejo.titulo}-${index}`}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  adviceTones[consejo.tipo] ?? adviceTones.info
                }`}
              >
                <strong>{consejo.titulo}</strong>
                <div className="mt-1">{consejo.texto}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Todo en orden: no hay alertas para el período seleccionado.
          </div>
        )}
      </SectionCard>
    </>
  );
}

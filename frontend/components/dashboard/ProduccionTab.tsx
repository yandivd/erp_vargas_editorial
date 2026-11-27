import Link from "next/link";
import {
  BarChart3,
  Clock,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { DashboardProduccion } from "@/lib/dashboard";
import { integer, money } from "@/lib/format";
import {
  BottleneckFunnelChart,
  MonthlyOrdersChart,
  OrderBehaviorChart,
  TopBooksChart,
} from "./charts";
import {
  EmptyTableRow,
  KpiCard,
  SectionCard,
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "./ui";

export default function ProduccionTab({ data }: { data: DashboardProduccion }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <KpiCard
          label="Pedidos"
          value={integer(data.kpis.pedidos_totales)}
          tone="violet"
        />
        <KpiCard
          label="Libros Únicos"
          value={integer(data.kpis.libros_unicos)}
          tone="cyan"
        />
        <KpiCard
          label="Libros 1 Pedido"
          value={integer(data.kpis.libros_con_un_pedido)}
        />
        <KpiCard
          label="Libros Repetidos"
          value={integer(data.kpis.libros_repetidos)}
        />
        <KpiCard
          label="Lead time"
          value={`${Number(data.kpis.lead_time_dias ?? 0).toFixed(1)} d`}
          sub="Impreso → Listo para Entregar"
          tone="blue"
        />
        <KpiCard
          label="Pedidos estancados"
          value={integer(data.kpis.pedidos_estancados ?? 0)}
          sub="Más de 5 días sin avanzar · Ver detalle"
          tone={(data.kpis.pedidos_estancados ?? 0) > 0 ? "red" : "emerald"}
          valueClassName={
            (data.kpis.pedidos_estancados ?? 0) > 0
              ? "text-red-500"
              : "text-emerald-600"
          }
          href="/pedidos?estancados=true&en_taller=false"
        />
        <KpiCard
          label="Capacidad del taller"
          value={`${Number(data.kpis.capacidad_semanal ?? 0).toFixed(1)} lib/sem`}
          sub={`${integer(data.kpis.libros_producidos_30d ?? 0)} libros en 30 días`}
          tone="cyan"
        />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <SectionCard
          title="Top 10 Libros"
          icon={<BarChart3 className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <div className="h-[180px] w-full md:h-[220px]">
            <TopBooksChart data={data.top10_data} />
          </div>
        </SectionCard>

        <SectionCard
          title="Pedidos por Mes"
          icon={<TrendingUp className="h-5 w-5 text-cyan-600" aria-hidden="true" />}
        >
          <div className="h-[180px] w-full md:h-[220px]">
            <MonthlyOrdersChart
              labels={data.pedidos_mes_data.labels}
              series={data.pedidos_mes_data.series}
            />
          </div>
        </SectionCard>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <SectionCard
          title="Comportamiento de Pedidos por Mes"
          icon={<TrendingUp className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <div className="h-[220px] w-full md:h-[280px]">
            <OrderBehaviorChart data={data.comportamiento_pedidos_mes} />
          </div>
        </SectionCard>

        <SectionCard
          title="Tiempo Promedio por Estado"
          icon={<Clock className="h-5 w-5 text-amber-500" aria-hidden="true" />}
        >
          <div className="h-[220px] w-full md:h-[280px]">
            <BottleneckFunnelChart data={data.tiempos_por_estado} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Ranking de los 30 Más Vendidos"
        icon={<Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />}
      >
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>#</th>
                <th className={thClass}>Libro</th>
                <th className={`${thClass} hidden md:table-cell`}>Autor</th>
                <th className={`${thClass} text-right`}>Pedidos</th>
                <th className={`${thClass} hidden text-right md:table-cell`}>
                  Ventas
                </th>
              </tr>
            </thead>
            <tbody>
              {data.ranking_data.length ? (
                data.ranking_data.map((libro, index) => (
                  <tr key={`${libro.titulo}-${index}`} className={tableRowClass}>
                    <td className={`${tdClass} text-muted`}>{index + 1}</td>
                    <td className={tdClass}>
                      <strong>{libro.titulo}</strong>
                      <div className="text-xs text-muted">
                        {integer(libro.paginas)} págs.
                      </div>
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      {libro.autor}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {integer(libro.pedidos)}
                    </td>
                    <td className={`${tdClass} hidden text-right md:table-cell`}>
                      {money(libro.ventas)}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyTableRow colSpan={5}>Sin pedidos</EmptyTableRow>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Pedidos estancados (> 5 días)"
        icon={<Clock className="h-5 w-5 text-red-500" aria-hidden="true" />}
      >
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Pedido</th>
                <th className={thClass}>Cliente</th>
                <th className={`${thClass} hidden md:table-cell`}>Libro</th>
                <th className={thClass}>Estado</th>
                <th className={`${thClass} text-right`}>Días</th>
                <th className={`${thClass} hidden text-right md:table-cell`}>
                  Último movimiento
                </th>
              </tr>
            </thead>
            <tbody>
              {data.pedidos_estancados_data?.length ? (
                data.pedidos_estancados_data.map((pedido) => (
                  <tr
                    key={pedido.id}
                    className="border-b border-red-100 bg-red-50 text-red-800 transition-colors hover:bg-red-100"
                  >
                    <td className={`${tdClass} font-semibold`}>
                      <Link
                        href={`/pedidos/${pedido.id}`}
                        className="text-red-700 no-underline hover:underline"
                      >
                        {pedido.referencia}
                      </Link>
                    </td>
                    <td className={tdClass}>{pedido.cliente}</td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      {pedido.libro}
                    </td>
                    <td className={tdClass}>{pedido.estado}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right font-bold`}>
                      {integer(pedido.dias)} d
                    </td>
                    <td className={`${tdClass} hidden text-right md:table-cell`}>
                      {pedido.fecha_estado}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyTableRow colSpan={6}>
                  No hay pedidos estancados.
                </EmptyTableRow>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="10 Libros Más Recientes"
        icon={<Clock className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
      >
        {data.recientes_data.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.recientes_data.map((libro) => (
              <div
                key={libro.id}
                className="rounded-xl border border-line p-3 transition hover:bg-slate-50"
              >
                <Link
                  href={`/pedidos/catalogo/${libro.id}`}
                  className="font-bold text-slate-900 no-underline hover:text-brand"
                >
                  {libro.titulo}
                </Link>
                <div className="text-sm text-muted">{libro.autor}</div>
                <div className="mt-2 flex justify-between text-sm">
                  <span>{integer(libro.pedidos)} pedidos</span>
                  <span>{integer(libro.clientes)} clientes</span>
                </div>
                <div className="mt-1 text-xs text-muted">Último: {libro.fecha}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-0 text-muted">Sin libros recientes.</p>
        )}
      </SectionCard>
    </>
  );
}

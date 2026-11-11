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
  MonthlyOrdersChart,
  OrderBehaviorChart,
  StateTimesChart,
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
            <StateTimesChart data={data.tiempos_por_estado} />
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

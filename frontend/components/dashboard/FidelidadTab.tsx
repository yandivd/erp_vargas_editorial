import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Gift,
  Info,
  LineChart,
  PieChart,
  Stamp,
  TrendingUp,
} from "lucide-react";
import type {
  DashboardFidelidad,
  TarjetaFidelidadResumen,
} from "@/lib/dashboard";
import { formatDate, integer, money, number } from "@/lib/format";
import {
  ComposicionIngresosChart,
  DistribucionSellosChart,
  TendenciaFidelidadChart,
  TicketMedioFidelidadChart,
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

const urgenciaStyles: Record<string, string> = {
  alta: "bg-red-50 text-red-700",
  media: "bg-amber-50 text-amber-700",
  baja: "bg-emerald-50 text-emerald-700",
};

const urgenciaLabels: Record<string, string> = {
  alta: "≤7 días",
  media: "≤15 días",
  baja: ">15 días",
};

function ClienteLink({ id, nombre }: { id: number; nombre: string }) {
  return (
    <Link
      href={`/clientes/${id}`}
      className="font-semibold text-slate-900 no-underline hover:text-brand"
    >
      {nombre}
    </Link>
  );
}

function UrgenciaBadge({ urgencia }: { urgencia: string }) {
  const estilo = urgenciaStyles[urgencia] ?? urgenciaStyles.baja;
  const label = urgenciaLabels[urgencia] ?? urgencia;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${estilo}`}
    >
      {label}
    </span>
  );
}

function TarjetasTable({
  tarjetas,
  emptyMessage,
}: {
  tarjetas: TarjetaFidelidadResumen[];
  emptyMessage: string;
}) {
  return (
    <div className={tableWrapClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Cliente</th>
            <th className={`${thClass} text-right`}>Sellos</th>
            <th className={`${thClass} text-right`}>Bono</th>
            <th className={`${thClass} hidden md:table-cell`}>Última compra</th>
          </tr>
        </thead>
        <tbody>
          {tarjetas.length ? (
            tarjetas.map((tarjeta) => (
              <tr key={tarjeta.id} className={tableRowClass}>
                <td className={tdClass}>
                  <ClienteLink id={tarjeta.id} nombre={tarjeta.nombre} />
                  <div className="mt-0.5 text-xs text-muted">
                    {tarjeta.telefono || "Sin teléfono"}
                  </div>
                </td>
                <td className={`${tdClass} text-right`}>
                  <span className="font-bold text-ink">
                    {tarjeta.sellos}/{tarjeta.meta}
                  </span>
                </td>
                <td className={`${tdClass} text-right`}>
                  <span
                    className={
                      tarjeta.bono_saldo > 0
                        ? "font-bold text-emerald-700"
                        : "text-muted"
                    }
                  >
                    {money(tarjeta.bono_saldo)}
                  </span>
                </td>
                <td className={`${tdClass} hidden md:table-cell`}>
                  {tarjeta.ultima_compra
                    ? formatDate(tarjeta.ultima_compra)
                    : "—"}
                </td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={4}>{emptyMessage}</EmptyTableRow>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function FidelidadTab({ data }: { data: DashboardFidelidad }) {
  const { kpis } = data;

  return (
    <>
      <div className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-sm text-slate-700">
        <strong className="text-brand">Fidelidad:</strong> los indicadores de
        pedidos, ingresos del período y bonos canjeados respetan el filtro de
        fechas. Se comparan clientes activos (con sellos o bono) contra
        inactivos (tarjeta vacía). Las ventanas de 30/90 días son fijas y los
        datos de tarjetas (adopción, sellos y saldo) son una foto actual.{" "}
        <Link
          href="/fidelidad"
          className="font-semibold text-brand hover:underline"
        >
          Administrar tarjetas
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Adopción"
          value={`${Number(kpis.adopcion_tarjeta).toFixed(1)}%`}
          sub={`${integer(kpis.tarjetas_total)} de ${integer(
            kpis.total_clientes,
          )} clientes`}
          tone="blue"
          valueClassName="text-brand"
        />
        <KpiCard
          label="Tarjetas activas"
          value={integer(kpis.tarjetas_activas)}
          sub={`${integer(kpis.tarjetas_total)} tarjetas en total`}
          tone="emerald"
          valueClassName="text-emerald-600"
        />
        <KpiCard
          label="Tarjetas completas"
          value={integer(kpis.tarjetas_completas)}
          sub={`Meta: ${integer(kpis.meta_sellos)} sellos`}
          tone="violet"
        />
        <KpiCard
          label="Bono pendiente"
          value={money(kpis.bono_pendiente_total)}
          sub={`${integer(kpis.clientes_con_bono)} clientes con bono`}
          tone="amber"
          valueClassName="text-amber-600"
        />
        <KpiCard
          label="Sellos promedio"
          value={number(kpis.sellos_promedio)}
          sub={`${integer(kpis.sellos_totales)} sellos acumulados`}
          tone="cyan"
        />
        <KpiCard
          label="En riesgo"
          value={integer(kpis.clientes_en_riesgo)}
          sub="≤7 días para expirar"
          tone="red"
          valueClassName="text-red-500"
        />
        <KpiCard
          label="Por expirar"
          value={integer(kpis.clientes_por_expirar)}
          sub="Entre 8 y 15 días"
          tone="amber"
          valueClassName="text-amber-600"
        />
        <KpiCard
          label="Ticket clientes activos"
          value={money(kpis.ticket_medio_activo)}
          sub={`${integer(kpis.pedidos_activos)} pedidos`}
          tone="emerald"
        />
        <KpiCard
          label="Ticket clientes inactivos"
          value={money(kpis.ticket_medio_inactivo)}
          sub={`${integer(kpis.pedidos_inactivos)} pedidos`}
          tone="neutral"
        />
        <KpiCard
          label="Ingresos activos 30 días"
          value={money(kpis.ingresos_activos_30d)}
          sub="Ventana fija de 30 días"
          tone="emerald"
        />
        <KpiCard
          label="Ingresos activos 90 días"
          value={money(kpis.ingresos_activos_90d)}
          sub="Ventana fija de 90 días"
          tone="blue"
        />
        <KpiCard
          label="Bono canjeado"
          value={money(kpis.bono_canjeado_total)}
          sub={`${integer(kpis.pedidos_con_bono)} pedidos con bono`}
          tone="pink"
        />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-12">
        <SectionCard
          className="md:col-span-7"
          title="Distribución de sellos"
          icon={<BarChart3 className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <div className="h-[200px] w-full md:h-[240px]">
            <DistribucionSellosChart data={data.distribucion_sellos} />
          </div>
        </SectionCard>

        <SectionCard
          className="md:col-span-5"
          title="Ingresos: clientes activos vs inactivos"
          icon={<PieChart className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
        >
          <div className="h-[200px] w-full md:h-[240px]">
            <ComposicionIngresosChart data={data.composicion_ingresos} />
          </div>
        </SectionCard>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-12">
        <SectionCard
          className="md:col-span-5"
          title="Ticket medio: clientes activos vs inactivos"
          icon={<TrendingUp className="h-5 w-5 text-amber-500" aria-hidden="true" />}
        >
          <div className="h-[200px] w-full md:h-[240px]">
            <TicketMedioFidelidadChart data={data.ticket_medio_data} />
          </div>
        </SectionCard>

        <SectionCard
          className="md:col-span-7"
          title="Tendencia mensual de ingresos"
          icon={<LineChart className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <div className="h-[200px] w-full md:h-[240px]">
            <TendenciaFidelidadChart data={data.tendencia_mensual} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Clientes en riesgo de expiración"
        icon={<AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />}
      >
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Cliente</th>
                <th className={`${thClass} text-right`}>Sellos</th>
                <th className={`${thClass} hidden md:table-cell`}>
                  Última compra
                </th>
                <th className={`${thClass} text-right`}>Días restantes</th>
                <th className={thClass}>Urgencia</th>
              </tr>
            </thead>
            <tbody>
              {data.clientes_riesgo_lista.length ? (
                data.clientes_riesgo_lista.map((cliente) => (
                  <tr key={cliente.id} className={tableRowClass}>
                    <td className={tdClass}>
                      <ClienteLink id={cliente.id} nombre={cliente.nombre} />
                      <div className="mt-0.5 text-xs text-muted">
                        {cliente.telefono || "Sin teléfono"}
                      </div>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <span className="font-bold text-ink">
                        {integer(cliente.sellos)}
                      </span>
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      {cliente.ultima_compra
                        ? formatDate(cliente.ultima_compra)
                        : "—"}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {integer(cliente.dias_restantes)}
                    </td>
                    <td className={tdClass}>
                      <UrgenciaBadge urgencia={cliente.urgencia} />
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyTableRow colSpan={5}>
                  Sin clientes próximos a expirar
                </EmptyTableRow>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Bonos disponibles"
        icon={<Gift className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
      >
        <TarjetasTable
          tarjetas={data.bonos_pendientes_lista}
          emptyMessage="Sin bonos pendientes"
        />
      </SectionCard>

      <SectionCard
        title="Tarjetas con más sellos"
        icon={<Stamp className="h-5 w-5 text-brand" aria-hidden="true" />}
      >
        <TarjetasTable
          tarjetas={data.tarjetas_destacadas}
          emptyMessage="Sin tarjetas registradas"
        />
      </SectionCard>

      {/* TODO: estas métricas se desbloquean con un modelo EventoFidelidad. */}
      <SectionCard
        title="Métricas pendientes de instrumentación"
        icon={<Info className="h-5 w-5 text-slate-500" aria-hidden="true" />}
      >
        <p className="mb-3 text-sm text-muted">
          Requieren registrar cada evento de fidelidad (otorgamiento, canje y
          expiración) para poder calcularlas con exactitud.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.no_disponibles.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 opacity-80"
            >
              <div className="text-sm font-bold text-slate-700">
                {item.label}
              </div>
              <p className="mt-1 text-xs text-muted">{item.motivo}</p>
              <div className="mt-2 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
                No disponible
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

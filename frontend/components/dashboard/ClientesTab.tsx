import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  MessageCircle,
  PieChart,
  Star,
} from "lucide-react";
import type { ClienteResumen, DashboardClientes } from "@/lib/dashboard";
import { integer, money, number } from "@/lib/format";
import { ClientFrequencyChart, ClientTypeChart } from "./charts";
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

function telefonoLink(telefono: string): string {
  const digits = String(telefono || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function ClienteNombre({ cliente }: { cliente: ClienteResumen }) {
  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className="font-semibold text-slate-900 no-underline hover:text-brand"
    >
      {cliente.nombre}
    </Link>
  );
}

function WhatsappButton({ telefono }: { telefono: string }) {
  const href = telefonoLink(telefono);
  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center rounded-md bg-emerald-600 p-1.5 text-white transition hover:bg-emerald-700"
      aria-label="Abrir WhatsApp"
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

export default function ClientesTab({ data }: { data: DashboardClientes }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Únicos"
          value={integer(data.kpis.clientes_unicos_total)}
          tone="cyan"
        />
        <KpiCard
          label="Nuevos"
          value={integer(data.kpis.clientes_nuevos)}
          valueClassName="text-cyan-600"
        />
        <KpiCard
          label="Recurrentes"
          value={integer(data.kpis.clientes_recurrentes)}
          tone="blue"
          valueClassName="text-brand"
        />
        <KpiCard
          label="VIP"
          value={integer(data.kpis.clientes_vip)}
          valueClassName="text-amber-500"
        />
        <KpiCard
          label="En Riesgo"
          value={integer(data.kpis.clientes_en_riesgo)}
          valueClassName="text-red-500"
        />
        <KpiCard
          label="Prom."
          value={number(data.kpis.promedio_pedidos)}
        />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-12">
        <SectionCard
          className="md:col-span-5"
          title="Tipo de Cliente"
          icon={<PieChart className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <div className="h-[180px] w-full md:h-[220px]">
            <ClientTypeChart data={data.tipo_cliente_data} />
          </div>
        </SectionCard>

        <SectionCard
          className="md:col-span-7"
          title="Frecuencia de Pedidos"
          icon={<BarChart3 className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
        >
          <div className="h-[180px] w-full md:h-[220px]">
            <ClientFrequencyChart data={data.frecuencia_data} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Clientes VIP"
        icon={<Star className="h-5 w-5 text-amber-500" aria-hidden="true" />}
      >
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Cliente</th>
                <th className={`${thClass} text-right`}>Pedidos</th>
                <th className={`${thClass} hidden text-right md:table-cell`}>
                  Total gastado
                </th>
                <th className={`${thClass} hidden md:table-cell`}>Último pedido</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {data.clientes_vip_lista.length ? (
                data.clientes_vip_lista.map((cliente) => (
                  <tr key={cliente.id} className={tableRowClass}>
                    <td className={tdClass}>
                      <ClienteNombre cliente={cliente} />
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {integer(cliente.pedidos)}
                    </td>
                    <td className={`${tdClass} hidden text-right md:table-cell`}>
                      {money(cliente.total_gastado)}
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      {cliente.ultimo_pedido}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <WhatsappButton telefono={cliente.telefono} />
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyTableRow colSpan={5}>Sin clientes VIP</EmptyTableRow>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Clientes en Riesgo (+90 días)"
        icon={
          <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
        }
      >
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Cliente</th>
                <th className={`${thClass} hidden text-right md:table-cell`}>
                  Pedidos
                </th>
                <th className={`${thClass} text-right`}>Días sin comprar</th>
                <th className={`${thClass} hidden md:table-cell`}>Último pedido</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {data.clientes_riesgo_lista.length ? (
                data.clientes_riesgo_lista.map((cliente) => (
                  <tr key={cliente.id} className={tableRowClass}>
                    <td className={tdClass}>
                      <ClienteNombre cliente={cliente} />
                    </td>
                    <td className={`${tdClass} hidden text-right md:table-cell`}>
                      {integer(cliente.pedidos)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {integer(cliente.dias_sin_comprar)}
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      {cliente.ultimo_pedido}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <WhatsappButton telefono={cliente.telefono} />
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyTableRow colSpan={5}>Sin clientes en riesgo</EmptyTableRow>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

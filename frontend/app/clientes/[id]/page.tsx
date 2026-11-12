import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Gift,
  MapPin,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import FidelidadCard from "@/components/fidelidad/FidelidadCard";
import {
  KpiCard,
  SectionCard,
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { apiFetch } from "@/lib/api";
import { badgeClass, type ClienteDetail } from "@/lib/clientes";
import { formatDate, money } from "@/lib/format";
import { estadoStyle } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClienteDetailPage({ params }: PageProps) {
  const { id } = await params;

  const result = await apiFetch<ClienteDetail>(
    `clientes/${encodeURIComponent(id)}/`,
  )
    .then((cliente) => ({ ok: true as const, cliente }))
    .catch((error: unknown) => ({
      ok: false as const,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo cargar el cliente.",
    }));

  if (!result.ok) {
    return (
      <div>
        <BackLink />
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el cliente.</strong>
            <div>{result.message}</div>
          </div>
        </div>
      </div>
    );
  }

  const cliente = result.cliente;
  const { estadisticas, historial_pedidos: pedidos } = cliente;

  return (
    <div>
      <BackLink />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
              <UserRound className="h-7 w-7 text-brand" aria-hidden="true" />
              {cliente.nombre}
            </h1>
            {cliente.badge ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${badgeClass(
                  cliente.badge.color,
                )}`}
              >
                <span aria-hidden="true">{cliente.badge.emoji}</span>
                {cliente.badge.label}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {cliente.total_libros} libros comprados ·{" "}
            {cliente.dias_sin_comprar >= 999
              ? "Sin compras entregadas"
              : `${cliente.dias_sin_comprar} día${
                  cliente.dias_sin_comprar === 1 ? "" : "s"
                } sin comprar`}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Total Facturado"
          value={money(estadisticas.total_facturado)}
          sub={`${estadisticas.total_pedidos} pedido${
            estadisticas.total_pedidos === 1 ? "" : "s"
          } registrado${
            estadisticas.total_pedidos === 1 ? "" : "s"
          }`}
          tone="blue"
        />
        <KpiCard
          label="Total Pagado"
          value={money(estadisticas.total_pagado)}
          sub="Anticipos y pagos recibidos"
          tone="emerald"
          valueClassName="text-emerald-600"
        />
        <KpiCard
          label="Deuda Pendiente"
          value={money(estadisticas.total_deuda)}
          sub={
            estadisticas.total_deuda > 0
              ? "Saldo actual por cobrar"
              : "El cliente está al día"
          }
          tone={estadisticas.total_deuda > 0 ? "red" : "emerald"}
          valueClassName={
            estadisticas.total_deuda > 0 ? "text-red-600" : "text-emerald-600"
          }
        />
      </div>

      <SectionCard
        title="Tarjeta de fidelidad"
        icon={<Gift className="h-5 w-5 text-brand" aria-hidden="true" />}
      >
        {cliente.fidelidad ? (
          <FidelidadCard
            nombre={cliente.nombre}
            sellos={cliente.fidelidad.sellos}
            meta={cliente.fidelidad.meta}
            bonoSaldo={cliente.fidelidad.bono_saldo}
            faltantes={cliente.fidelidad.faltantes}
            publicHref={`/fidelidad/${cliente.fidelidad.token}`}
          />
        ) : (
          <p className="text-sm text-muted">
            Este cliente todavía no tiene una tarjeta de fidelidad.
          </p>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="Datos de contacto"
          icon={<UserRound className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <dl className="space-y-4">
            <Info
              label="Teléfono"
              icon={<Phone className="h-4 w-4" aria-hidden="true" />}
              value={cliente.telefono || "—"}
            />
            <Info
              label="Dirección"
              icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
              value={cliente.direccion || "—"}
            />
            <Info
              label="Cliente desde"
              icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
              value={formatDate(cliente.fecha_registro)}
            />
          </dl>
          {cliente.notas ? (
            <div className="mt-4 border-t border-line pt-3">
              <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                Notas
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                {cliente.notas}
              </p>
            </div>
          ) : null}
        </SectionCard>

        <div className="xl:col-span-2">
          <SectionCard
            title="Historial de Pedidos"
            icon={
              <ReceiptText className="h-5 w-5 text-brand" aria-hidden="true" />
            }
          >
            {pedidos.length === 0 ? (
              <p className="text-sm text-muted">
                Este cliente aún no tiene pedidos registrados.
              </p>
            ) : (
              <div className={tableWrapClass}>
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={`${thClass} hidden sm:table-cell`}>#</th>
                      <th className={thClass}>Libro</th>
                      <th className={`${thClass} hidden md:table-cell`}>
                        Fecha
                      </th>
                      <th className={`${thClass} hidden md:table-cell`}>
                        Precio
                      </th>
                      <th className={thClass}>Saldo</th>
                      <th className={thClass}>Estado</th>
                      <th className={`${thClass} text-right`}>
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((pedido) => {
                      const referencia = pedido.referencia_externa ?? pedido.id;
                      const saldo = Number(pedido.saldo_pendiente);

                      return (
                        <tr key={pedido.id} className={tableRowClass}>
                          <td
                            className={`${tdClass} hidden font-semibold text-muted sm:table-cell`}
                          >
                            #{referencia}
                          </td>
                          <td className={tdClass}>
                            <div className="font-semibold text-ink">
                              {pedido.libro_titulo}
                            </div>
                            <div className="text-[0.75rem] text-muted">
                              {pedido.libro_autor || "Sin autor"} ·{" "}
                              {pedido.cantidad} ejemplar
                              {pedido.cantidad === 1 ? "" : "es"}
                            </div>
                          </td>
                          <td
                            className={`${tdClass} hidden md:table-cell`}
                          >
                            {formatDate(pedido.fecha_pedido)}
                          </td>
                          <td
                            className={`${tdClass} hidden md:table-cell`}
                          >
                            {money(pedido.precio_venta)}
                          </td>
                          <td className={tdClass}>
                            {saldo > 0 ? (
                              <span className="font-bold text-red-600">
                                {money(saldo)}
                              </span>
                            ) : (
                              <span className="font-semibold text-emerald-600">
                                Pagado
                              </span>
                            )}
                          </td>
                          <td className={tdClass}>
                            <span
                              className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                              style={estadoStyle(pedido.estado_color)}
                            >
                              {pedido.estado_nombre}
                            </span>
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <Link
                              href={`/pedidos/${pedido.id}`}
                              className="inline-flex items-center rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
                            >
                              Ver pedido
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/clientes"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Volver a clientes
    </Link>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div>
        <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
          {label}
        </dt>
        <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
      </div>
    </div>
  );
}

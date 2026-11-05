import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock3,
  ReceiptText,
  StickyNote,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import PedidoActions from "@/components/pedidos/PedidoActions";
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
import { calcularCostoPorUnidad, type ParametrosCosto } from "@/lib/costos";
import { formatDate, formatDateTime, money } from "@/lib/format";
import {
  estadoStyle,
  type EstadoPedido,
  type PedidoDetail,
} from "@/lib/pedidos";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PedidoDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [estados, result] = await Promise.all([
    apiFetch<EstadoPedido[]>("pedidos/estados/").catch(() => []),
    apiFetch<PedidoDetail>(`pedidos/${encodeURIComponent(id)}/`)
      .then((pedido) => ({ ok: true as const, pedido }))
      .catch((error: unknown) => ({
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el pedido.",
      })),
  ]);

  if (!result.ok) {
    return (
      <div>
        <BackLink />
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el pedido.</strong>
            <div>{result.message}</div>
          </div>
        </div>
      </div>
    );
  }

  const pedido = result.pedido;
  const saldo = Number(pedido.saldo_pendiente);
  const totalServicios = pedido.servicios_externos.reduce(
    (total, servicio) => total + Number(servicio.monto),
    0,
  );

  const costoProduccion =
    pedido.costo_produccion != null
      ? Number(pedido.costo_produccion)
      : (await calcularCostoProduccion(pedido));
  const gananciaBruta =
    costoProduccion === null
      ? Number(pedido.ganancia_bruta)
      : Number(pedido.precio_venta) - costoProduccion;
  const gananciaClassName =
    gananciaBruta >= 0 ? "text-emerald-600" : "text-red-600";
  const gananciaTone = gananciaBruta >= 0 ? "emerald" : "red";

  return (
    <div>
      <BackLink />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold text-ink">
              Pedido #{pedido.id}
            </h1>
            <span
              className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
              style={estadoStyle(pedido.estado_color)}
            >
              {pedido.estado_nombre}
            </span>
            {pedido.es_historico ? (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Histórico
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {pedido.cliente_nombre} · {pedido.libro_titulo}
            {pedido.referencia_externa
              ? ` · Ref. ${pedido.referencia_externa}`
              : ""}
          </p>
        </div>

        <PedidoActions
          pedidoId={pedido.id}
          estadoActual={pedido.estado_id}
          estados={estados}
        />
      </div>

      {pedido.esta_atrasado ? (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>Entrega atrasada.</strong> La fecha prometida era el{" "}
            {formatDate(pedido.fecha_entrega_prometida)}.
          </div>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Precio de venta"
          value={money(pedido.precio_venta)}
          sub={`Cantidad: ${pedido.cantidad}`}
          tone="blue"
        />
        <KpiCard
          label="Anticipo recibido"
          value={money(pedido.anticipo_recibido)}
          sub={`Requerido: ${money(pedido.anticipo_requerido)}`}
          tone="emerald"
        />
        <KpiCard
          label="Saldo pendiente"
          value={money(pedido.saldo_pendiente)}
          sub={saldo > 0 ? "Pendiente de cobro" : "Pedido pagado"}
          tone={saldo > 0 ? "amber" : "emerald"}
          valueClassName={saldo > 0 ? "text-amber-600" : "text-emerald-600"}
        />
        <KpiCard
          label="Ganancia bruta"
          value={money(gananciaBruta)}
          sub={`Costo producción: ${money(costoProduccion ?? 0)} · Servicios externos: ${money(totalServicios)}`}
          tone={gananciaTone}
          valueClassName={gananciaClassName}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="Cliente y entrega"
          icon={<UserRound className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Info label="Cliente" value={pedido.cliente_nombre} />
            <Info label="Teléfono" value={pedido.cliente_telefono || "—"} />
            <Info
              label="Dirección del cliente"
              value={pedido.cliente_direccion || "—"}
            />
            <Info
              label="Teléfono de entrega"
              value={pedido.telefono_entrega || "—"}
            />
            <Info
              label="Dirección de entrega"
              value={pedido.direccion_entrega || pedido.cliente_direccion || "—"}
              className="sm:col-span-2"
            />
          </dl>
        </SectionCard>

        <SectionCard
          title="Libro y producción"
          icon={<BookOpen className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Info label="Título" value={pedido.libro_titulo} />
            <Info label="Autor" value={pedido.libro_autor || "—"} />
            <Info label="Cantidad" value={String(pedido.cantidad)} />
            <Info
              label="Horas invertidas"
              value={
                pedido.horas_invertidas
                  ? Number(pedido.horas_invertidas).toFixed(2)
                  : "—"
              }
            />
            <div className="sm:col-span-2">
              <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                Acabados
              </dt>
              <dd className="mt-1.5 flex flex-wrap gap-2">
                <Tag active={pedido.lleva_scotch} label="Scotch" />
                <Tag active={pedido.lleva_esquineros} label="Esquineros" />
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Fechas"
          icon={<CalendarDays className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Info
              label="Fecha del pedido"
              value={formatDateTime(pedido.fecha_pedido)}
            />
            <Info
              label="Entrega prometida"
              value={formatDate(pedido.fecha_entrega_prometida) || "—"}
            />
            <Info
              label="Entrega real"
              value={formatDateTime(pedido.fecha_entrega_real) || "—"}
            />
            <Info
              label="Días para entregar"
              value={
                pedido.dias_para_entrega === null
                  ? "—"
                  : `${pedido.dias_para_entrega} día${
                      pedido.dias_para_entrega === 1 ? "" : "s"
                    }`
              }
            />
          </dl>
        </SectionCard>

        <SectionCard
          title="Condiciones económicas"
          icon={<Wallet className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Info label="Precio de venta" value={money(pedido.precio_venta)} />
            <Info
              label="Descuento aplicado"
              value={money(pedido.descuento_aplicado)}
            />
            <Info
              label="Anticipo requerido"
              value={money(pedido.anticipo_requerido)}
            />
            <Info
              label="Anticipo recibido"
              value={money(pedido.anticipo_recibido)}
            />
            <Info
              label="Saldo pendiente"
              value={money(pedido.saldo_pendiente)}
            />
            <Info
              label="Costo de producción"
              value={money(costoProduccion ?? 0)}
            />
            <Info
              label="Ganancia bruta"
              value={money(gananciaBruta)}
              valueClassName={gananciaClassName}
            />
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title="Anticipos recibidos"
        icon={<ReceiptText className="h-5 w-5 text-brand" aria-hidden="true" />}
        className="mt-4"
      >
        {pedido.anticipos.length === 0 ? (
          <p className="text-sm text-muted">
            Este pedido todavía no tiene pagos registrados.
          </p>
        ) : (
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Fecha</th>
                  <th className={thClass}>Concepto</th>
                  <th className={thClass}>Categoría</th>
                  <th className={thClass}>Método</th>
                  <th className={`${thClass} text-right`}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {pedido.anticipos.map((anticipo) => (
                  <tr key={anticipo.id} className={tableRowClass}>
                    <td className={tdClass}>
                      {formatDateTime(anticipo.fecha)}
                    </td>
                    <td className={tdClass}>{anticipo.concepto}</td>
                    <td className={tdClass}>
                      {anticipo.categoria_display}
                    </td>
                    <td className={tdClass}>{anticipo.metodo_display}</td>
                    <td
                      className={`${tdClass} text-right font-bold text-emerald-600`}
                    >
                      {money(anticipo.monto, anticipo.moneda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Servicios externos"
        icon={<Truck className="h-5 w-5 text-brand" aria-hidden="true" />}
        className="mt-4"
      >
        {pedido.servicios_externos.length === 0 ? (
          <p className="text-sm text-muted">
            Este pedido no tiene servicios externos registrados.
          </p>
        ) : (
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Proveedor</th>
                  <th className={thClass}>Tipo</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass}>Solicitado</th>
                  <th className={thClass}>Recibido</th>
                  <th className={thClass}>Lote</th>
                  <th className={`${thClass} text-right`}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {pedido.servicios_externos.map((servicio) => (
                  <tr key={servicio.id} className={tableRowClass}>
                    <td className={tdClass}>{servicio.proveedor_nombre}</td>
                    <td className={tdClass}>{servicio.tipo_display}</td>
                    <td className={tdClass}>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${servicioEstadoClass(
                          servicio.estado,
                        )}`}
                      >
                        {servicio.estado_display}
                      </span>
                    </td>
                    <td className={tdClass}>
                      {formatDate(servicio.fecha_solicitud)}
                    </td>
                    <td className={tdClass}>
                      {formatDate(servicio.fecha_recepcion) || "—"}
                    </td>
                    <td className={tdClass}>{servicio.lote_numero || "—"}</td>
                    <td className={`${tdClass} text-right font-semibold`}>
                      {money(servicio.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {pedido.notas ? (
        <SectionCard
          title="Notas"
          icon={<StickyNote className="h-5 w-5 text-brand" aria-hidden="true" />}
          className="mt-4"
        >
          <p className="whitespace-pre-wrap text-sm text-ink">{pedido.notas}</p>
        </SectionCard>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/pedidos"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Volver a pedidos
    </Link>
  );
}

function Info({
  label,
  value,
  className = "",
  valueClassName = "",
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-medium text-ink ${valueClassName}`}>
        {value}
      </dd>
    </div>
  );
}

async function calcularCostoProduccion(
  pedido: PedidoDetail,
): Promise<number | null> {
  try {
    const [{ parametros }, paginas] = await Promise.all([
      apiFetch<{ parametros: ParametrosCosto }>(
        "pedidos/parametros-costo/",
      ),
      pedido.libro_paginas
        ? Promise.resolve(Number(pedido.libro_paginas))
        : apiFetch<{ paginas: number }>(`libros/${pedido.libro_id}/`).then(
            (libro) => Number(libro.paginas),
          ),
    ]);

    if (!Number.isFinite(paginas) || paginas <= 0) {
      return null;
    }

    return calcularCostoPorUnidad(
      paginas,
      pedido.lleva_scotch,
      pedido.lleva_esquineros,
      parametros,
    ).costo_total;
  } catch {
    return null;
  }
}

function Tag({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <Clock3 className="h-3 w-3" aria-hidden="true" />
      {active ? label : `Sin ${label.toLowerCase()}`}
    </span>
  );
}

function servicioEstadoClass(estado: string): string {
  if (estado === "PAGADO") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (estado === "RECIBIDO") {
    return "bg-sky-100 text-sky-700";
  }
  return "bg-amber-100 text-amber-700";
}

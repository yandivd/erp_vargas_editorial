import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  MapPin,
  Package,
  Printer,
  ReceiptText,
  StickyNote,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, money } from "@/lib/format";
import type { EntregaDetail } from "@/lib/entregas";
import ConfirmarEntrega from "@/components/entregas/ConfirmarEntrega";
import {
  EmptyTableRow,
  KpiCard,
  SectionCard,
  tableClass,
  tableRowClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

export default async function EntregaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let entrega: EntregaDetail | null = null;
  let error = "";

  try {
    entrega = await apiFetch<EntregaDetail>(
      `entregas/${encodeURIComponent(id)}/`,
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo cargar la entrega.";
  }

  if (error || !entrega) {
    return (
      <div>
        <Link
          href="/entregas"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a entregas
        </Link>
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error || "No se encontró la entrega."}</p>
        </div>
      </div>
    );
  }

  const servicios = entrega.pedidos.flatMap((pedido) =>
    pedido.servicios_externos.map((servicio) => ({
      ...servicio,
      pedido_id: pedido.id,
      libro_titulo: pedido.libro_titulo,
    })),
  );

  return (
    <div>
      <Link
        href="/entregas"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a entregas
      </Link>

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white">
            <Truck className="h-6 w-6" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-ink md:text-2xl">
                Entrega #{entrega.id}
              </h1>
              <span
                className={[
                  "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                  entrega.entregado
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                ].join(" ")}
              >
                {entrega.estado}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
              <UserRound className="h-4 w-4" />
              {entrega.cliente_nombre}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://vargaserp.pythonanywhere.com/pedidos/entregas/${entrega.id}/comprobante-carta/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:bg-blue-50 hover:text-brand"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Imprimir Comprobante
          </a>
          {!entrega.entregado ? (
            <ConfirmarEntrega
              entregaId={entrega.id}
              clienteNombre={entrega.cliente_nombre}
              totalACobrar={Number(entrega.total_a_cobrar)}
              saldoPedidos={Number(entrega.saldo_pedidos)}
              costoMensajeria={Number(entrega.costo_mensajeria)}
            />
          ) : null}
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total de pedidos"
          value={money(entrega.total_pedidos)}
          sub={`${entrega.cantidad_pedidos} pedido(s)`}
          tone="blue"
        />
        <KpiCard
          label="Anticipos recibidos"
          value={money(entrega.total_anticipos)}
          tone="emerald"
        />
        <KpiCard
          label="Saldo de pedidos"
          value={money(entrega.saldo_pedidos)}
          tone={Number(entrega.saldo_pedidos) > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Total a cobrar"
          value={money(entrega.total_a_cobrar)}
          sub={`Mensajería: ${money(entrega.costo_mensajeria)}`}
          tone="red"
        />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem
          icon={<MapPin className="h-4 w-4" />}
          label="Dirección"
          value={entrega.direccion || "Sin dirección"}
        />
        <InfoItem
          icon={<CalendarDays className="h-4 w-4" />}
          label="Fecha prevista"
          value={formatDate(entrega.fecha_entrega) || "Sin fecha"}
        />
        <InfoItem
          icon={<CalendarDays className="h-4 w-4" />}
          label="Fecha real"
          value={
            formatDateTime(entrega.fecha_entrega_real) || "Pendiente"
          }
        />
        <InfoItem
          icon={<StickyNote className="h-4 w-4" />}
          label="Notas"
          value={entrega.notas || "Sin notas"}
        />
      </div>

      <SectionCard title="Pedidos en la entrega" icon={<BookOpen className="h-5 w-5" />}>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Referencia</th>
                <th className={thClass}>Libro</th>
                <th className={thClass}>Cant.</th>
                <th className={thClass}>Precio</th>
                <th className={thClass}>Anticipo</th>
                <th className={thClass}>Saldo</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {entrega.pedidos.length === 0 ? (
                <EmptyTableRow colSpan={7}>
                  Esta entrega no tiene pedidos asociados.
                </EmptyTableRow>
              ) : (
                entrega.pedidos.map((pedido) => (
                  <tr key={pedido.id} className={tableRowClass}>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-900">
                        {pedido.referencia_externa || `Pedido #${pedido.id}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        #{pedido.id}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-900">
                        {pedido.libro_titulo}
                      </p>
                      <p className="text-xs text-slate-500">
                        {pedido.libro_autor}
                      </p>
                    </td>
                    <td className={tdClass}>{pedido.cantidad}</td>
                    <td className={tdClass}>{money(pedido.precio_venta)}</td>
                    <td className={tdClass}>
                      {money(pedido.anticipo_recibido)}
                    </td>
                    <td className={tdClass}>
                      <span
                        className={
                          Number(pedido.saldo_pendiente) > 0
                            ? "font-semibold text-amber-700"
                            : "font-semibold text-emerald-700"
                        }
                      >
                        {money(pedido.saldo_pendiente)}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {pedido.estado_nombre}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Servicios externos"
        icon={<Package className="h-5 w-5" />}
      >
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Pedido</th>
                <th className={thClass}>Proveedor</th>
                <th className={thClass}>Tipo</th>
                <th className={thClass}>Lote</th>
                <th className={thClass}>Monto</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {servicios.length === 0 ? (
                <EmptyTableRow colSpan={6}>
                  No hay servicios externos asociados.
                </EmptyTableRow>
              ) : (
                servicios.map((servicio) => (
                  <tr key={servicio.id} className={tableRowClass}>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-900">
                        {servicio.libro_titulo}
                      </p>
                      <p className="text-xs text-slate-500">
                        Pedido #{servicio.pedido_id}
                      </p>
                    </td>
                    <td className={tdClass}>{servicio.proveedor_nombre}</td>
                    <td className={tdClass}>{servicio.tipo_display}</td>
                    <td className={tdClass}>
                      {servicio.lote_numero || "Sin lote"}
                    </td>
                    <td className={tdClass}>{money(servicio.monto)}</td>
                    <td className={tdClass}>
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {servicio.estado_display}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Resumen de cobro" icon={<Wallet className="h-5 w-5" />}>
        <div className="space-y-2 text-sm">
          <SummaryRow
            label="Saldo de pedidos"
            value={money(entrega.saldo_pedidos)}
          />
          <SummaryRow
            label="Costo de mensajería"
            value={money(entrega.costo_mensajeria)}
          />
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
            <span>Total a cobrar</span>
            <span>{money(entrega.total_a_cobrar)}</span>
          </div>
        </div>
        {!entrega.entregado ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <ReceiptText className="h-4 w-4 shrink-0" />
            Al confirmar, se registrará el pago y todos los pedidos pasarán a
            Entregado.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

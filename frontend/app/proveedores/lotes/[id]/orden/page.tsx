import { AlertTriangle } from "lucide-react";
import PrintButton from "@/components/inventario/PrintButton";
import { apiFetch } from "@/lib/api";
import { formatDateTime, integer, money } from "@/lib/format";
import {
  referenciaPedido,
  type LoteOrdenData,
} from "@/lib/proveedores";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrdenLotePage({ params }: PageProps) {
  const { id } = await params;
  const result = await apiFetch<LoteOrdenData>(
    `proveedores/lotes/${encodeURIComponent(id)}/orden/`,
  )
    .then((data) => ({ data, error: null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo generar la orden del lote.",
    }));

  if (result.error || !result.data) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white">
        <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo generar la orden del lote.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const { lote, proveedor, pedidos } = result.data;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:min-h-0 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4;
          margin: 18mm;
        }
        @media print {
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-3xl justify-end print:hidden">
        <PrintButton />
      </div>

      <article className="mx-auto max-w-3xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              Vargas ERP
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-wide text-slate-900">
              ORDEN DE SERVICIO
            </h1>
            <p className="mt-1 text-sm text-muted">
              Servicios externos agrupados por lote
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-slate-900">{lote.numero}</p>
            <p className="mt-1 text-muted">
              {formatDateTime(lote.fecha_apertura)}
            </p>
            <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {lote.estado_label}
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
              Proveedor
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Nombre</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {proveedor.nombre}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Tipo</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {proveedor.tipo_label}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Teléfono</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {proveedor.telefono || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Dirección</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {proveedor.direccion || "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
              Lote
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Número</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {lote.numero}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Servicio</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {lote.tipo_label}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Pedidos</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {pedidos.length}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Total</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {money(lote.total)}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="mt-8">
          <h2 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Pedidos asociados
          </h2>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  Pedido
                </th>
                <th className="border-b border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  Libro
                </th>
                <th className="border-b border-line px-2 py-2 text-right text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  Cantidad
                </th>
                <th className="border-b border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  Cliente
                </th>
                <th className="border-b border-line px-2 py-2 text-right text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.pedido_id}>
                  <td className="border-b border-line px-2 py-2.5 text-sm font-semibold text-slate-900">
                    {referenciaPedido(
                      pedido.referencia_externa,
                      pedido.pedido_id,
                    )}
                  </td>
                  <td className="border-b border-line px-2 py-2.5 text-sm text-slate-900">
                    {pedido.libro_titulo}
                  </td>
                  <td className="border-b border-line px-2 py-2.5 text-right text-sm text-slate-900">
                    {integer(pedido.cantidad)}
                  </td>
                  <td className="border-b border-line px-2 py-2.5 text-sm text-slate-900">
                    {pedido.cliente_nombre}
                  </td>
                  <td className="border-b border-line px-2 py-2.5 text-right text-sm text-slate-900">
                    {money(pedido.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={4}
                  className="px-2 pt-3 text-right text-sm font-semibold text-slate-700"
                >
                  Total del lote
                </td>
                <td className="px-2 pt-3 text-right text-sm font-black text-slate-900">
                  {money(lote.total)}
                </td>
              </tr>
              {Number(lote.total_pendiente) > 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-2 pt-1 text-right text-xs font-semibold text-red-600"
                  >
                    Pendiente de pago
                  </td>
                  <td className="px-2 pt-1 text-right text-xs font-black text-red-600">
                    {money(lote.total_pendiente)}
                  </td>
                </tr>
              ) : null}
            </tfoot>
          </table>
        </section>

        <div className="mt-8 rounded-lg border border-line bg-slate-50 px-4 py-3 text-xs leading-relaxed text-muted print:bg-white">
          Esta orden respalda los servicios externos indicados. Debe ser
          verificada por el proveedor y autorizada por la dirección antes de
          registrar el pago.
        </div>

        <div className="mt-16 grid gap-10 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto h-10 border-b border-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
              Proveedor
            </p>
            <p className="mt-1 text-sm text-muted">{proveedor.nombre}</p>
          </div>
          <div className="text-center">
            <div className="mx-auto h-10 border-b border-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
              Recibido por
            </p>
            <p className="mt-1 text-sm text-muted">Firma</p>
          </div>
          <div className="text-center">
            <div className="mx-auto h-10 border-b border-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
              Autorizado por
            </p>
            <p className="mt-1 text-sm text-muted">Firma</p>
          </div>
        </div>
      </article>
    </div>
  );
}

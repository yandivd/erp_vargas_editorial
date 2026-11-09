import { AlertTriangle } from "lucide-react";
import PrintButton from "@/components/inventario/PrintButton";
import { apiFetch } from "@/lib/api";
import { formatDateTime, number } from "@/lib/format";
import type { InventarioOrdenTrabajoData } from "@/lib/inventario";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function referenciaPedido(
  pedido: InventarioOrdenTrabajoData["pedido"],
): string {
  if (!pedido) {
    return "Sin pedido asociado";
  }

  return pedido.referencia_externa
    ? `#${pedido.referencia_externa}`
    : `#${pedido.id}`;
}

export default async function OrdenTrabajoPage({ params }: PageProps) {
  const { id } = await params;
  const result = await apiFetch<InventarioOrdenTrabajoData>(
    `inventario/movimiento/${encodeURIComponent(id)}/orden-trabajo/`,
  )
    .then((data) => ({ data, error: null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo generar la orden de trabajo.",
    }));

  if (result.error || !result.data) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white">
        <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo generar la orden de trabajo.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const data = result.data;

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
              ORDEN DE TRABAJO
            </h1>
            <p className="mt-1 text-sm text-muted">
              Salida de material de inventario
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-slate-900">
              No. {String(data.movimiento.id).padStart(6, "0")}
            </p>
            <p className="mt-1 text-muted">
              {formatDateTime(data.movimiento.fecha)}
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
              Material
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Nombre</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {data.material.nombre}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Unidad</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {data.material.unidad_medida}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Cantidad</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {number(data.movimiento.cantidad)} {data.material.unidad_medida}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
              Movimiento
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Tipo</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {data.movimiento.tipo_label}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Pedido</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {referenciaPedido(data.pedido)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Solicitado por</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {data.solicitante || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Motivo</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {data.movimiento.motivo || "—"}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-8 rounded-lg border border-line bg-slate-50 px-4 py-3 text-xs leading-relaxed text-muted print:bg-white">
          Esta orden respalda la salida de material indicada. Debe ser firmada
          por el almacenero, la dirección y la persona que retira el material.
        </div>

        <div className="mt-16 grid gap-10 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto h-10 border-b border-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
              Almacenero
            </p>
            <p className="mt-1 text-sm text-muted">
              {data.almacenero || "Firma"}
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto h-10 border-b border-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
              CEO
            </p>
            <p className="mt-1 text-sm text-muted">{data.ceo || "Firma"}</p>
          </div>
          <div className="text-center">
            <div className="mx-auto h-10 border-b border-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
              Quien retira
            </p>
            <p className="mt-1 text-sm text-muted">Firma</p>
          </div>
        </div>
      </article>
    </div>
  );
}

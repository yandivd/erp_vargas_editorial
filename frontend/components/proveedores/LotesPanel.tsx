"use client";

import {
  CheckCircle2,
  FileText,
  Package,
  SearchX,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { formatDateTime, money } from "@/lib/format";
import {
  referenciaPedido,
  type LoteServicio,
  type Proveedor,
} from "@/lib/proveedores";
import PagarLoteModal from "./PagarLoteModal";

type Tab = "abiertos" | "pagados";

export default function LotesPanel({
  proveedor,
  abiertos,
  pagados,
}: {
  proveedor: Proveedor;
  abiertos: LoteServicio[];
  pagados: LoteServicio[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("abiertos");
  const [lotePago, setLotePago] = useState<LoteServicio | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const lotes = tab === "abiertos" ? abiertos : pagados;

  function handlePagado(vuelto: number) {
    const numero = lotePago?.numero ?? "";
    const detalleVuelto =
      vuelto > 0 ? ` Vuelto a entregar: ${money(vuelto)}.` : "";

    setExito(`Lote ${numero} pagado correctamente.${detalleVuelto}`);
    setLotePago(null);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Lotes del proveedor"
          className="inline-flex rounded-lg border border-line bg-slate-50 p-1"
        >
          <TabButton
            active={tab === "abiertos"}
            onClick={() => setTab("abiertos")}
          >
            Abiertos
            <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[0.68rem] font-bold text-slate-600">
              {abiertos.length}
            </span>
          </TabButton>
          <TabButton
            active={tab === "pagados"}
            onClick={() => setTab("pagados")}
          >
            Pagados
            <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[0.68rem] font-bold text-slate-600">
              {pagados.length}
            </span>
          </TabButton>
        </div>

        <div className="text-sm text-muted">
          Deuda con el proveedor:{" "}
          <strong
            className={
              Number(proveedor.deuda_total) > 0
                ? "text-red-600"
                : "text-emerald-700"
            }
          >
            {money(proveedor.deuda_total)}
          </strong>
        </div>
      </div>

      {exito ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{exito}</span>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {lotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
            <SearchX className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-ink">
              {tab === "abiertos"
                ? "No hay lotes abiertos"
                : "No hay lotes pagados"}
            </p>
            <p className="mt-1 text-sm">
              {tab === "abiertos"
                ? "Los servicios externos pendientes aparecerán aquí."
                : "Los lotes cancelados por completo se mostrarán aquí."}
            </p>
          </div>
        ) : (
          lotes.map((lote) => (
            <article
              key={lote.id}
              className="overflow-hidden rounded-xl border border-line"
            >
              <header className="flex flex-col gap-3 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                      <Package className="h-4 w-4 text-brand" aria-hidden="true" />
                      {lote.numero}
                    </span>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.7rem] font-semibold text-blue-700">
                      {lote.tipo_label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
                        lote.estado === "PAGADO"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {lote.estado_label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Apertura: {formatDateTime(lote.fecha_apertura)}
                    {lote.fecha_pago
                      ? ` · Pago: ${formatDateTime(lote.fecha_pago)}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <div className="text-sm">
                    <span className="text-muted">Total: </span>
                    <strong className="text-ink">{money(lote.total)}</strong>
                    {Number(lote.total_pendiente) > 0 ? (
                      <span className="ml-2 text-xs font-semibold text-red-600">
                        Pendiente: {money(lote.total_pendiente)}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/proveedores/lotes/${lote.id}/orden`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Generar Orden
                  </Link>
                  {tab === "abiertos" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setExito(null);
                        setLotePago(lote);
                      }}
                      disabled={Number(lote.total_pendiente) <= 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      title={
                        Number(lote.total_pendiente) <= 0
                          ? "El lote no tiene servicios pendientes"
                          : "Registrar pago del lote"
                      }
                    >
                      <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                      Pagar
                    </button>
                  ) : null}
                </div>
              </header>

              <div className={tableWrapClass}>
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>Pedido</th>
                      <th className={thClass}>Libro</th>
                      <th className={`${thClass} hidden md:table-cell`}>
                        Cliente
                      </th>
                      <th className={thClass}>Cantidad</th>
                      <th className={thClass}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lote.servicios.map((servicio) => (
                      <tr key={servicio.id} className={tableRowClass}>
                        <td className={tdClass}>
                          <span className="font-semibold text-ink">
                            {referenciaPedido(
                              servicio.referencia_externa,
                              servicio.pedido_id,
                            )}
                          </span>
                          <span className="ml-1.5 text-xs text-muted">
                            {servicio.tipo_label}
                          </span>
                        </td>
                        <td className={tdClass}>{servicio.libro_titulo}</td>
                        <td className={`${tdClass} hidden md:table-cell`}>
                          {servicio.cliente_nombre}
                        </td>
                        <td className={tdClass}>{servicio.cantidad}</td>
                        <td className={tdClass}>{money(servicio.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))
        )}
      </div>

      {lotePago ? (
        <PagarLoteModal
          lote={lotePago}
          onClose={() => setLotePago(null)}
          onPagado={handlePagado}
        />
      ) : null}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-white text-ink shadow-sm"
          : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

"use client";

import {
  AlertCircle,
  History,
  Loader2,
  Printer,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateTime, number } from "@/lib/format";
import type {
  InventarioHistorialData,
  InventarioHistorialMovimiento,
  InventarioMaterial,
} from "@/lib/inventario";

type HistorialModalProps = {
  material: InventarioMaterial;
};

function referenciaPedido(
  pedido: InventarioHistorialMovimiento["pedido"],
): string {
  if (!pedido) {
    return "—";
  }

  return pedido.referencia_externa
    ? `#${pedido.referencia_externa}`
    : `#${pedido.id}`;
}

export default function HistorialModal({ material }: HistorialModalProps) {
  const [abierto, setAbierto] = useState(false);
  const [historial, setHistorial] = useState<InventarioHistorialData | null>(
    null,
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    let cancelado = false;

    async function cargarHistorial() {
      setCargando(true);
      setError(null);

      try {
        const response = await apiFetch<InventarioHistorialData>(
          `inventario/${material.id}/historial/`,
        );

        if (!cancelado) {
          setHistorial(response);
        }
      } catch (requestError) {
        if (!cancelado) {
          setHistorial(null);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar el historial.",
          );
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    void cargarHistorial();

    return () => {
      cancelado = true;
    };
  }, [abierto, material.id]);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAbierto(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [abierto]);

  function abrir() {
    setHistorial(null);
    setError(null);
    setAbierto(true);
  }

  function imprimirOrden(movimientoId: number) {
    window.open(
      `/inventario/orden-trabajo/${movimientoId}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const movimientos = historial?.movimientos ?? [];

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-slate-50 hover:text-ink"
      >
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        Historial
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAbierto(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="historial-material-title"
            className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="historial-material-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Historial de movimientos
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {material.nombre} · Stock actual:{" "}
                  <span className="font-semibold text-ink">
                    {number(historial?.material.stock_actual ?? material.stock_actual)}{" "}
                    {material.unidad_medida}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {error ? (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-line">
              {cargando ? (
                <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Cargando historial...
                </div>
              ) : movimientos.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted">
                  Este material todavía no tiene movimientos registrados.
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">
                        Fecha
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">
                        Tipo
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                        Cantidad
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                        Costo
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">
                        Pedido
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">
                        Usuario
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">
                        Motivo
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {movimientos.map((movimiento) => (
                      <tr key={movimiento.id} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                          {formatDateTime(movimiento.fecha)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              movimiento.tipo === "ENTRADA"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {movimiento.tipo_label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-ink">
                          {number(movimiento.cantidad)} {material.unidad_medida}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted">
                          ${number(movimiento.costo_total)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                          {referenciaPedido(movimiento.pedido)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                          {movimiento.usuario?.nombre || "—"}
                        </td>
                        <td className="min-w-48 px-3 py-2.5 text-muted">
                          {movimiento.motivo || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          {movimiento.tipo === "SALIDA" ? (
                            <button
                              type="button"
                              onClick={() => imprimirOrden(movimiento.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
                            >
                              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                              Orden de trabajo
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

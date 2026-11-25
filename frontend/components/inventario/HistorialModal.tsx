"use client";

import {
  AlertCircle,
  Check,
  History,
  Loader2,
  Pencil,
  Printer,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateTime, number } from "@/lib/format";
import type {
  InventarioCostoCorregidoResponse,
  InventarioHistorialData,
  InventarioHistorialMovimiento,
  InventarioMaterial,
} from "@/lib/inventario";

type HistorialModalProps = {
  material: InventarioMaterial;
  materiales: InventarioMaterial[];
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

export default function HistorialModal({
  material,
  materiales,
}: HistorialModalProps) {
  const [abierto, setAbierto] = useState(false);
  const [materialId, setMaterialId] = useState(material.id);
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [historial, setHistorial] = useState<InventarioHistorialData | null>(
    null,
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [costoInput, setCostoInput] = useState("");
  const [guardandoCosto, setGuardandoCosto] = useState(false);
  const [accionMensaje, setAccionMensaje] = useState<string | null>(null);

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
          `inventario/${materialId}/historial`,
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
  }, [abierto, materialId]);

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
    setMaterialId(material.id);
    setTipoFiltro("");
    setHistorial(null);
    setError(null);
    setAccionMensaje(null);
    setEditandoId(null);
    setAbierto(true);
  }

  function imprimirOrden(movimientoId: number) {
    window.open(
      `/inventario/orden-trabajo/${movimientoId}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function empezarCorreccion(movimiento: InventarioHistorialMovimiento) {
    setAccionMensaje(null);
    setEditandoId(movimiento.id);
    setCostoInput(String(movimiento.costo_unitario));
  }

  function cancelarCorreccion() {
    setEditandoId(null);
    setCostoInput("");
  }

  async function guardarCorreccion(
    movimiento: InventarioHistorialMovimiento,
  ) {
    const valor = Number(costoInput);

    if (!Number.isFinite(valor) || valor < 0) {
      setAccionMensaje("Indica un costo unitario válido (0 o mayor).");
      return;
    }

    setGuardandoCosto(true);
    setAccionMensaje(null);

    try {
      const response = await apiFetch<InventarioCostoCorregidoResponse>(
        `inventario/movimiento/${movimiento.id}/costo/`,
        {
          method: "PATCH",
          body: JSON.stringify({ costo_unitario: valor }),
        },
      );

      setHistorial((actual) =>
        actual
          ? {
              ...actual,
              material: {
                ...actual.material,
                stock_actual: response.data.material.stock_actual,
                costo_promedio: response.data.material.costo_promedio,
              },
              movimientos: actual.movimientos.map((item) =>
                item.id === movimiento.id
                  ? {
                      ...item,
                      costo_unitario: response.data.movimiento.costo_unitario,
                      costo_total: response.data.movimiento.costo_total,
                    }
                  : item,
              ),
            }
          : actual,
      );
      setEditandoId(null);
      setAccionMensaje("Costo corregido correctamente.");
    } catch (requestError) {
      setAccionMensaje(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo corregir el costo.",
      );
    } finally {
      setGuardandoCosto(false);
    }
  }

  const materialActual = historial?.material;
  const movimientos = (historial?.movimientos ?? []).filter(
    (movimiento) => !tipoFiltro || movimiento.tipo === tipoFiltro,
  );
  const movimientoEditando = movimientos.find(
    (movimiento) => movimiento.id === editandoId,
  );

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
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
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
            className="my-auto flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-line bg-white p-5 shadow-2xl"
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
                  {materialActual?.nombre ?? material.nombre} · Stock actual:{" "}
                  <span className="font-semibold text-ink">
                    {number(materialActual?.stock_actual ?? material.stock_actual)}{" "}
                    {materialActual?.unidad_medida ?? material.unidad_medida}
                  </span>
                  {materialActual?.costo_promedio !== undefined ? (
                    <>
                      {" · Costo promedio: "}
                      <span className="font-semibold text-ink">
                        ${number(materialActual.costo_promedio)}
                      </span>
                    </>
                  ) : null}
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

            {accionMensaje ? (
              <div
                role="status"
                className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                  accionMensaje.includes("correctamente")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {accionMensaje}
              </div>
            ) : null}

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="historial-material"
                  className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted"
                >
                  Material
                </label>
                <select
                  id="historial-material"
                  value={materialId}
                  onChange={(event) => {
                    setMaterialId(Number(event.target.value));
                    setHistorial(null);
                  }}
                  disabled={cargando}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                >
                  {materiales.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="historial-tipo"
                  className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted"
                >
                  Tipo
                </label>
                <select
                  id="historial-tipo"
                  value={tipoFiltro}
                  onChange={(event) => setTipoFiltro(event.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Todos</option>
                  <option value="ENTRADA">Entradas</option>
                  <option value="SALIDA">Salidas</option>
                </select>
              </div>
            </div>

            {movimientoEditando?.tipo === "ENTRADA" ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Corregir una entrada actualiza el costo promedio del material, pero no modifica el pago registrado en Caja.
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
                  {tipoFiltro
                    ? "No hay movimientos de este tipo para el material seleccionado."
                    : "Este material todavía no tiene movimientos registrados."}
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
                          {number(movimiento.cantidad)}{" "}
                          {materialActual?.unidad_medida ?? material.unidad_medida}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted">
                          {editandoId === movimiento.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span>$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                aria-label="Costo unitario"
                                value={costoInput}
                                onChange={(event) =>
                                  setCostoInput(event.target.value)
                                }
                                className="w-24 rounded-lg border border-brand bg-white px-2 py-1 text-right text-sm text-ink outline-none focus:ring-2 focus:ring-brand/20"
                              />
                            </div>
                          ) : (
                            <>
                              <div>${number(movimiento.costo_total)}</div>
                              <div className="text-xs text-muted">
                                ${number(movimiento.costo_unitario)} /{" "}
                                {materialActual?.unidad_medida ??
                                  material.unidad_medida}
                              </div>
                            </>
                          )}
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
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {editandoId === movimiento.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={guardandoCosto}
                                  onClick={() => void guardarCorreccion(movimiento)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  {guardandoCosto ? (
                                    <Loader2
                                      className="h-3.5 w-3.5 animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  disabled={guardandoCosto}
                                  onClick={cancelarCorreccion}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-slate-50 disabled:opacity-60"
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => empezarCorreccion(movimiento)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-slate-50 hover:text-ink"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  Corregir costo
                                </button>
                                {movimiento.tipo === "SALIDA" ? (
                                  <button
                                    type="button"
                                    onClick={() => imprimirOrden(movimiento.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
                                  >
                                    <Printer
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                    Orden de trabajo
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
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

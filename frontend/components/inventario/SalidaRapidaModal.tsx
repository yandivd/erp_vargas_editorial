"use client";

import { AlertCircle, Loader2, PackageMinus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { number } from "@/lib/format";
import type {
  InventarioMaterial,
  InventarioMovimientoResponse,
} from "@/lib/inventario";
import type { PedidoListItem } from "@/lib/pedidos";

type SalidaRapidaModalProps = {
  material: InventarioMaterial;
};

export default function SalidaRapidaModal({
  material,
}: SalidaRapidaModalProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [pedidoId, setPedidoId] = useState("");
  const [pedidos, setPedidos] = useState<PedidoListItem[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    let cancelado = false;

    async function cargarPedidos() {
      setCargandoPedidos(true);

      try {
        const response = await apiFetch<PedidoListItem[]>(
          "pedidos/?en_taller=true&per_page=100",
        );

        if (!cancelado) {
          setPedidos(response);
        }
      } catch {
        if (!cancelado) {
          setPedidos([]);
        }
      } finally {
        if (!cancelado) {
          setCargandoPedidos(false);
        }
      }
    }

    void cargarPedidos();

    return () => {
      cancelado = true;
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !guardando) {
        setAbierto(false);
        setError(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [abierto, guardando]);

  function abrir() {
    setCantidad("1");
    setMotivo("");
    setPedidoId("");
    setGuardando(false);
    setError(null);
    setAbierto(true);
  }

  function cerrar() {
    if (guardando) {
      return;
    }

    setAbierto(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) {
      return;
    }

    const cantidadNumero = Number(cantidad);

    if (!Number.isFinite(cantidadNumero) || cantidadNumero <= 0) {
      setError("La cantidad debe ser mayor a cero.");
      return;
    }

    if (cantidadNumero > material.stock_actual) {
      setError("La cantidad no puede superar el stock actual.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch<InventarioMovimientoResponse["data"]>(
        "inventario/movimiento/",
        {
          method: "POST",
          body: JSON.stringify({
            material_id: material.id,
            tipo: "SALIDA",
            cantidad: cantidadNumero,
            motivo: motivo.trim(),
            pedido_id: pedidoId ? Number(pedidoId) : null,
          }),
        },
      );

      setAbierto(false);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar la salida.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
      >
        <PackageMinus className="h-3.5 w-3.5" aria-hidden="true" />
        Salida Rápida
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cerrar();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="salida-rapida-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="salida-rapida-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Salida rápida
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {material.nombre} · Disponible:{" "}
                  <span className="font-semibold text-ink">
                    {number(material.stock_actual)} {material.unidad_medida}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={cerrar}
                disabled={guardando}
                className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed"
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="salida-rapida-cantidad"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Cantidad *
                </label>
                <input
                  id="salida-rapida-cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                  disabled={guardando}
                  required
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label
                  htmlFor="salida-rapida-motivo"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Motivo
                </label>
                <input
                  id="salida-rapida-motivo"
                  type="text"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  disabled={guardando}
                  placeholder="Motivo de la salida"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label
                  htmlFor="salida-rapida-pedido"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Pedido (opcional)
                </label>
                <select
                  id="salida-rapida-pedido"
                  value={pedidoId}
                  onChange={(event) => setPedidoId(event.target.value)}
                  disabled={guardando || cargandoPedidos}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                >
                  <option value="">
                    {cargandoPedidos
                      ? "Cargando pedidos..."
                      : "Sin pedido asociado"}
                  </option>
                  {pedidos.map((pedido) => (
                    <option key={pedido.id} value={String(pedido.id)}>
                      {pedido.referencia_externa
                        ? `#${pedido.referencia_externa}`
                        : `#${pedido.id}`}
                      {" - "}
                      {pedido.cliente_nombre}
                      {" - "}
                      {pedido.libro_titulo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cerrar}
                  disabled={guardando}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <PackageMinus className="h-4 w-4" aria-hidden="true" />
                  )}
                  {guardando ? "Registrando..." : "Registrar salida"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

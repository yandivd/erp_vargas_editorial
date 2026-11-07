"use client";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { apiFetch } from "@/lib/api";
import { money } from "@/lib/format";
import {
  estadoStyle,
  type CambioEstadoMasivoResultado,
  type EstadoPedido,
  type PedidoListItem,
} from "@/lib/pedidos";

type PedidosTableProps = {
  pedidos: PedidoListItem[];
  estados: EstadoPedido[];
};

type Message = {
  type: "success" | "warning";
  text: string;
};

export default function PedidosTable({
  pedidos,
  estados,
}: PedidosTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [nuevoEstadoId, setNuevoEstadoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectedCount = selectedIds.size;
  const allSelected =
    pedidos.length > 0 &&
    pedidos.every((pedido) => selectedIds.has(pedido.id));
  const someSelected = selectedCount > 0 && !allSelected;

  const estadosDisponibles = estados.filter(
    (estado) =>
      estado.activo &&
      estado.nombre !== "Entregado" &&
      estado.nombre !== "Cancelado",
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        setModalOpen(false);
        setError(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen, loading]);

  function toggleAll() {
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(pedidos.map((pedido) => pedido.id)),
    );
  }

  function toggleOne(pedidoId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(pedidoId)) {
        next.delete(pedidoId);
      } else {
        next.add(pedidoId);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function openModal() {
    if (selectedCount === 0) {
      return;
    }

    setNuevoEstadoId("");
    setError(null);
    setMessage(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (loading) {
      return;
    }

    setModalOpen(false);
    setError(null);
  }

  async function handleBulkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    if (!nuevoEstadoId) {
      setError("Selecciona el estado al que quieres cambiar.");
      return;
    }

    if (selectedCount === 0) {
      setError("Selecciona al menos un pedido.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resultado = await apiFetch<CambioEstadoMasivoResultado>(
        "pedidos/cambiar-estado-masivo/",
        {
          method: "POST",
          body: JSON.stringify({
            pedido_ids: Array.from(selectedIds),
            estado_id: Number(nuevoEstadoId),
          }),
        },
      );

      clearSelection();
      setModalOpen(false);
      setMessage(
        resultado.errores.length > 0
          ? {
              type: "warning",
              text: `${resultado.actualizados} pedido(s) actualizados. ${resultado.errores.join(" ")}`,
            }
          : {
              type: "success",
              text: `${resultado.actualizados} pedido(s) cambiados a "${resultado.estado.nombre}".`,
            },
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cambiar el estado de los pedidos.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {selectedCount > 0 ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-amber-900">
            {selectedCount} pedido{selectedCount === 1 ? "" : "s"}{" "}
            seleccionado{selectedCount === 1 ? "" : "s"}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Cambiar Estado
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{message.text}</span>
        </div>
      ) : null}

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={`${thClass} w-10`}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Seleccionar todos los pedidos de esta página"
                  className="h-4 w-4 cursor-pointer accent-blue-600"
                />
              </th>
              <th className={thClass}>Ref.</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Libro</th>
              <th className={thClass}>Estado</th>
              <th className={`${thClass} text-right`}>Saldo</th>
              <th className={thClass}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((pedido) => {
              const selected = selectedIds.has(pedido.id);
              const referencia = pedido.referencia_externa ?? pedido.id;

              return (
                <tr
                  key={pedido.id}
                  className={`${tableRowClass} ${
                    selected ? "bg-blue-50" : ""
                  }`}
                >
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOne(pedido.id)}
                      aria-label={`Seleccionar pedido ${referencia}`}
                      className="h-4 w-4 cursor-pointer accent-blue-600"
                    />
                  </td>
                  <td className={tdClass}>
                    <Link
                      href={`/pedidos/${pedido.id}`}
                      className="font-bold text-brand hover:underline"
                    >
                      #{referencia}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    <div className="font-semibold text-ink">
                      {pedido.cliente_nombre}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <div className="font-medium text-ink">
                      {pedido.libro_titulo}
                    </div>
                    <div className="text-[0.75rem] text-muted">
                      {pedido.libro_autor || "Sin autor"}
                    </div>
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
                    <div
                      className={`font-bold ${
                        Number(pedido.saldo_pendiente) > 0
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {money(pedido.saldo_pendiente)}
                    </div>
                    <div className="text-[0.72rem] text-muted">
                      Anticipo {money(pedido.anticipo_recibido)}
                    </div>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link
                      href={`/pedidos/${pedido.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Ver
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-estado-modal-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="bulk-estado-modal-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Cambiar estado
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedCount} pedido{selectedCount === 1 ? "" : "s"}{" "}
                  seleccionado{selectedCount === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
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

            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="bulk-nuevo-estado"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Nuevo estado
                </label>
                <select
                  id="bulk-nuevo-estado"
                  value={nuevoEstadoId}
                  onChange={(event) => setNuevoEstadoId(event.target.value)}
                  disabled={loading}
                  required
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                >
                  <option value="">Selecciona un estado...</option>
                  {estadosDisponibles.map((estado) => (
                    <option key={estado.id} value={String(estado.id)}>
                      {estado.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Si el estado activa una automatización, Django creará los
                lotes de servicio y sus servicios externos correspondientes.
              </p>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || selectedCount === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {loading ? "Aplicando..." : "Aplicar cambio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

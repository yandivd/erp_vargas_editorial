"use client";

import {
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { apiFetch } from "@/lib/api";
import {
  type EstadoPedido,
  type PedidoDetail,
} from "@/lib/pedidos";

type PedidoActionsProps = {
  pedidoId: number;
  estadoActual: number;
  estados: EstadoPedido[];
};

export default function PedidoActions({
  pedidoId,
  estadoActual,
  estados,
}: PedidoActionsProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [estado, setEstado] = useState(String(estadoActual));
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadosDisponibles = estados.filter(
    (item) => item.activo || item.id === estadoActual,
  );

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

  function openModal() {
    setEstado(String(estadoActual));
    setNotas("");
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (loading) {
      return;
    }
    setModalOpen(false);
    setError(null);
  }

  async function handleEstadoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    const seleccionado = estadosDisponibles.find(
      (item) => String(item.id) === estado,
    );

    if (!seleccionado) {
      setError("Selecciona un estado válido.");
      return;
    }

    const confirmar = window.confirm(
      `¿Cambiar el pedido #${pedidoId} al estado "${seleccionado.nombre}"?`,
    );

    if (!confirmar) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch<PedidoDetail>(
        `pedidos/${pedidoId}/cambiar-estado/`,
        {
          method: "POST",
          body: JSON.stringify({
            estado: seleccionado.nombre,
            notas: notas.trim(),
          }),
        },
      );
      setModalOpen(false);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cambiar el estado.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:bg-blue-50 hover:text-brand"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Cambiar Estado
        </button>
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
            aria-labelledby="pedido-modal-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="pedido-modal-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Cambiar estado
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Pedido #{pedidoId}
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

            <form onSubmit={handleEstadoSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="nuevo-estado"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Nuevo estado
                </label>
                <select
                  id="nuevo-estado"
                  value={estado}
                  onChange={(event) => setEstado(event.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                >
                  {estadosDisponibles.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="notas-estado"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Notas
                </label>
                <textarea
                  id="notas-estado"
                  rows={3}
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  disabled={loading}
                  placeholder="Detalle opcional del cambio de estado"
                  className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                />
              </div>

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
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {loading ? "Guardando..." : "Confirmar cambio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

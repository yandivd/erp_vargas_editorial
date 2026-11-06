"use client";

import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { apiFetch } from "@/lib/api";
import { money, number } from "@/lib/format";
import {
  METODOS_PAGO,
  type EstadoPedido,
  type PedidoDetail,
} from "@/lib/pedidos";

type PedidoActionsProps = {
  pedidoId: number;
  estadoActual: number;
  estados: EstadoPedido[];
  saldoPendiente: number;
};

type PagoModo = "PAGO" | "ENTREGA";

type TasaCambioResponse = {
  tasa_cambio: number;
};

function redondear2(value: number): number {
  return Math.round(value * 100) / 100;
}

export default function PedidoActions({
  pedidoId,
  estadoActual,
  estados,
  saldoPendiente,
}: PedidoActionsProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [estado, setEstado] = useState(String(estadoActual));
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [pagoModo, setPagoModo] = useState<PagoModo>("PAGO");
  const [montoCup, setMontoCup] = useState("");
  const [montoUsd, setMontoUsd] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [tasaCambio, setTasaCambio] = useState<number | null>(null);
  const [tasaLoading, setTasaLoading] = useState(false);
  const [tasaError, setTasaError] = useState<string | null>(null);
  const [pagoLoading, setPagoLoading] = useState(false);
  const [pagoError, setPagoError] = useState<string | null>(null);

  const estadosDisponibles = estados.filter(
    (item) => item.activo || item.id === estadoActual,
  );

  const montoCupNumero = Number(montoCup || 0);
  const montoUsdNumero = Number(montoUsd || 0);
  const montosValidos =
    Number.isFinite(montoCupNumero) &&
    Number.isFinite(montoUsdNumero) &&
    montoCupNumero >= 0 &&
    montoUsdNumero >= 0;
  const usaUsd = montoUsdNumero > 0;
  const usdEntero = Number.isInteger(montoUsdNumero);
  const tasaValida =
    !usaUsd ||
    (tasaCambio !== null &&
      Number.isFinite(tasaCambio) &&
      tasaCambio > 0);
  const totalPagadoCup = montosValidos
    ? redondear2(montoCupNumero + montoUsdNumero * (tasaCambio ?? 0))
    : 0;
  const montoValido = montosValidos && totalPagadoCup > 0;
  const vueltoCup =
    totalPagadoCup > saldoPendiente + 0.005
      ? redondear2(totalPagadoCup - saldoPendiente)
      : 0;
  const restante = Math.max(0, redondear2(saldoPendiente - totalPagadoCup));
  const faltaParaEntrega =
    pagoModo === "ENTREGA" &&
    totalPagadoCup > 0 &&
    totalPagadoCup + 0.005 < saldoPendiente;

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

  useEffect(() => {
    if (!pagoModalOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pagoLoading) {
        setPagoModalOpen(false);
        setPagoError(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pagoModalOpen, pagoLoading]);

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

  async function cargarTasaCambio() {
    setTasaLoading(true);
    setTasaError(null);

    try {
      const data = await apiFetch<TasaCambioResponse>(
        "pedidos/tasa-cambio/",
      );
      const tasa = Number(data.tasa_cambio);

      if (!Number.isFinite(tasa) || tasa <= 0) {
        throw new Error("La tasa de cambio configurada no es válida.");
      }

      setTasaCambio(tasa);
    } catch (requestError) {
      setTasaCambio(null);
      setTasaError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar la tasa de cambio.",
      );
    } finally {
      setTasaLoading(false);
    }
  }

  function openPagoModal(modo: PagoModo = "PAGO") {
    setPagoModo(modo);
    setPagoModalOpen(true);
    setMontoCup("");
    setMontoUsd("");
    setMetodoPago("EFECTIVO");
    setPagoError(null);
    setTasaCambio(null);
    setTasaError(null);
    void cargarTasaCambio();
  }

  function closePagoModal() {
    if (pagoLoading) {
      return;
    }
    setPagoModalOpen(false);
    setPagoError(null);
  }

  function handleMontoCupChange(value: string) {
    const limpio = value.replace(/[^\d.]/g, "");
    const [entero, ...decimales] = limpio.split(".");
    setMontoCup(
      decimales.length > 0
        ? `${entero}.${decimales.join("").slice(0, 2)}`
        : entero,
    );
    setPagoError(null);
  }

  function handleMontoUsdChange(value: string) {
    setMontoUsd(value.replace(/\D/g, ""));
    setPagoError(null);
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

    if (seleccionado.nombre === "Entregado" && saldoPendiente > 0.005) {
      setModalOpen(false);
      setError(null);
      openPagoModal("ENTREGA");
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

  async function handlePagoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pagoLoading) {
      return;
    }

    setPagoError(null);

    if (!montoValido) {
      setPagoError("Indica al menos un monto mayor que cero.");
      return;
    }
    if (!usdEntero) {
      setPagoError("Los pagos en USD deben ser un monto entero, sin centavos.");
      return;
    }
    if (usaUsd && !tasaValida) {
      setPagoError("No hay una tasa de cambio válida para el pago en USD.");
      return;
    }
    if (pagoModo === "ENTREGA" && faltaParaEntrega) {
      setPagoError(
        `Faltan ${money(saldoPendiente - totalPagadoCup)} CUP para saldar el pedido.`,
      );
      return;
    }

    setPagoLoading(true);

    try {
      if (pagoModo === "ENTREGA") {
        await apiFetch<PedidoDetail>(
          `pedidos/${pedidoId}/cambiar-estado/`,
          {
            method: "POST",
            body: JSON.stringify({
              estado: "Entregado",
              notas: notas.trim(),
              monto_cup: montoCupNumero,
              monto_usd: montoUsdNumero,
              tasa_aplicada: usaUsd ? tasaCambio : null,
              metodo: metodoPago,
            }),
          },
        );
      } else {
        await apiFetch<PedidoDetail>(
          `pedidos/${pedidoId}/registrar-anticipo/`,
          {
            method: "POST",
            body: JSON.stringify({
              monto_cup: montoCupNumero,
              monto_usd: montoUsdNumero,
              tasa_aplicada: usaUsd ? tasaCambio : null,
              metodo: metodoPago,
            }),
          },
        );
      }

      setPagoModalOpen(false);
      setMontoCup("");
      setMontoUsd("");
      setNotas("");
      router.refresh();
    } catch (requestError) {
      setPagoError(
        requestError instanceof Error
          ? requestError.message
          : pagoModo === "ENTREGA"
            ? "No se pudo cobrar y entregar el pedido."
            : "No se pudo registrar el pago.",
      );
    } finally {
      setPagoLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openPagoModal()}
          disabled={saldoPendiente <= 0}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          title={
            saldoPendiente <= 0
              ? "El pedido no tiene saldo pendiente"
              : "Registrar anticipo o abono"
          }
        >
          <Wallet className="h-4 w-4" aria-hidden="true" />
          Registrar pago
        </button>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:bg-blue-50 hover:text-brand"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Cambiar Estado
        </button>
      </div>

      {pagoModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePagoModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pago-modal-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="pago-modal-title"
                  className="text-lg font-extrabold text-ink"
                >
                  {pagoModo === "ENTREGA"
                    ? "Cobrar y entregar"
                    : "Registrar pago"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Pedido #{pedidoId} · Saldo pendiente: {money(saldoPendiente)}
                </p>
                {pagoModo === "ENTREGA" ? (
                  <p className="mt-1 text-sm text-muted">
                    Registra lo cobrado para marcar el pedido como Entregado.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closePagoModal}
                disabled={pagoLoading}
                className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {pagoError ? (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{pagoError}</span>
              </div>
            ) : null}

            <form onSubmit={handlePagoSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="monto-cup"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Monto en CUP
                  </label>
                  <input
                    id="monto-cup"
                    name="monto-cup"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={montoCup}
                    onChange={(event) =>
                      handleMontoCupChange(event.target.value)
                    }
                    disabled={pagoLoading}
                    placeholder="0.00"
                    autoComplete="off"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="monto-usd"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Monto en USD (entero)
                  </label>
                  <input
                    id="monto-usd"
                    name="monto-usd"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={montoUsd}
                    onChange={(event) =>
                      handleMontoUsdChange(event.target.value)
                    }
                    disabled={pagoLoading}
                    placeholder="0"
                    autoComplete="off"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="metodo-pago"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Método
                </label>
                <select
                  id="metodo-pago"
                  value={metodoPago}
                  onChange={(event) => setMetodoPago(event.target.value)}
                  disabled={pagoLoading}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                >
                  {METODOS_PAGO.map((metodo) => (
                    <option key={metodo.value} value={metodo.value}>
                      {metodo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                {tasaLoading ? (
                  <p className="flex items-center gap-2">
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Cargando tasa de cambio...
                  </p>
                ) : tasaError ? (
                  <p className="flex items-start gap-2 text-red-700">
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{tasaError}</span>
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p>
                      Tasa actual:{" "}
                      <strong>1 USD = {number(tasaCambio ?? 0)} CUP</strong>
                    </p>
                    {usaUsd ? (
                      <p>
                        Equivalente USD:{" "}
                        <strong>
                          {money(montoUsdNumero * (tasaCambio ?? 0))} CUP
                        </strong>
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span>Total pagado</span>
                  <strong>{money(totalPagadoCup)} CUP</strong>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <span>Restante</span>
                  <strong>{money(restante)} CUP</strong>
                </div>
              </div>

              {vueltoCup > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Vuelto a entregar:{" "}
                    <strong>{money(vueltoCup)} CUP</strong>
                  </span>
                </div>
              ) : null}

              {faltaParaEntrega ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Faltan{" "}
                    <strong>
                      {money(saldoPendiente - totalPagadoCup)} CUP
                    </strong>{" "}
                    para poder entregar el pedido.
                  </span>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closePagoModal}
                  disabled={pagoLoading}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pagoLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pagoLoading ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {pagoLoading
                    ? "Procesando..."
                    : pagoModo === "ENTREGA"
                      ? "Cobrar y entregar"
                      : "Registrar pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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

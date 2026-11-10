"use client";

import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  moneyCaja,
  registrarCompraDivisa,
  registrarVentaDivisa,
} from "@/lib/finanzas";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export default function DivisaModal({
  modo,
  saldoUsd,
  tasaSistema,
}: {
  modo: "compra" | "venta";
  saldoUsd: number;
  tasaSistema: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [montoUsd, setMontoUsd] = useState("");
  const [tasa, setTasa] = useState(String(tasaSistema));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monto = Number(montoUsd);
  const tasaNumero = Number(tasa);
  const montoTotalCUP =
    Number.isFinite(monto) && Number.isFinite(tasaNumero)
      ? monto * tasaNumero
      : 0;

  function abrir() {
    setMontoUsd("");
    setTasa(String(tasaSistema));
    setGuardando(false);
    setError(null);
    setAbierto(true);
  }

  function cerrar() {
    if (guardando) {
      return;
    }
    setAbierto(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (guardando) {
      return;
    }

    const montoNumero = Number(montoUsd);
    const tasaNumero = Number(tasa);

    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      setError("El monto en USD debe ser mayor que cero.");
      return;
    }

    if (!Number.isFinite(tasaNumero) || tasaNumero <= 0) {
      setError("La tasa de cambio debe ser mayor que cero.");
      return;
    }

    if (modo === "venta" && montoNumero > saldoUsd) {
      setError("No hay suficiente USD disponible.");
      return;
    }

    setError(null);
    setGuardando(true);

    try {
      const response =
        modo === "compra"
          ? await registrarCompraDivisa({
              monto_usd: montoNumero,
              tasa_cambio: tasaNumero,
            })
          : await registrarVentaDivisa({
              monto_usd: montoNumero,
              tasa_cambio: tasaNumero,
            });

      setAbierto(false);
      router.refresh();
      return response;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar la operación.",
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
        className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-extrabold text-white transition sm:w-auto ${
          modo === "compra"
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-amber-600 hover:bg-amber-700"
        }`}
      >
        {modo === "compra" ? (
          <ArrowDownCircle className="h-5 w-5" aria-hidden="true" />
        ) : (
          <ArrowUpCircle className="h-5 w-5" aria-hidden="true" />
        )}
        {modo === "compra" ? "Comprar USD" : "Vender USD"}
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
            aria-labelledby="divisa-modal-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="divisa-modal-title"
                  className="text-lg font-extrabold text-ink"
                >
                  {modo === "compra" ? "Comprar USD" : "Vender USD"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {modo === "compra"
                    ? "Registra la compra de divisas y su costo en CUP."
                    : "Registra la venta de divisas y su ingreso en CUP."}
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
                  htmlFor={modo === "compra" ? "divisa-monto-compra" : "divisa-monto-venta"}
                  className={labelClass}
                >
                  Monto en USD *
                </label>
                <input
                  id={modo === "compra" ? "divisa-monto-compra" : "divisa-monto-venta"}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={montoUsd}
                  onChange={(event) => setMontoUsd(event.target.value)}
                  disabled={guardando}
                  required
                  autoFocus
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label
                  htmlFor={modo === "compra" ? "divisa-tasa-compra" : "divisa-tasa-venta"}
                  className={labelClass}
                >
                  Tasa de Cambio *
                </label>
                <input
                  id={modo === "compra" ? "divisa-tasa-compra" : "divisa-tasa-venta"}
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={tasa}
                  onChange={(event) => setTasa(event.target.value)}
                  disabled={guardando}
                  required
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label
                  htmlFor={modo === "compra" ? "divisa-total-compra" : "divisa-total-venta"}
                  className={labelClass}
                >
                  {modo === "compra"
                    ? "Monto total a pagar en CUP *"
                    : "Monto total a recibir en CUP *"}
                </label>
                <input
                  id={modo === "compra" ? "divisa-total-compra" : "divisa-total-venta"}
                  type="number"
                  readOnly
                  value={montoTotalCUP.toFixed(2)}
                  className={inputClass}
                  aria-readonly="true"
                />
              </div>

              {modo === "venta" ? (
                <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-ink">
                  <span className="font-semibold">Saldo disponible USD:</span>{" "}
                  {moneyCaja(saldoUsd, "USD")}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrar}
                  disabled={guardando}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    modo === "compra"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {guardando
                    ? "Confirmando..."
                    : modo === "compra"
                      ? "Confirmar compra"
                      : "Confirmar venta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

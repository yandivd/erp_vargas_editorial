"use client";

import {
  AlertCircle,
  Loader2,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { money, number } from "@/lib/format";
import { METODOS_PAGO } from "@/lib/pedidos";
import type { LoteServicio, PagoLoteData } from "@/lib/proveedores";

type TasaCambioResponse = {
  tasa_cambio: number;
};

function redondear2(value: number): number {
  return Math.round(value * 100) / 100;
}

export default function PagarLoteModal({
  lote,
  onClose,
  onPagado,
}: {
  lote: LoteServicio;
  onClose: () => void;
  onPagado: (vuelto: number) => void;
}) {
  const total = Number(lote.total_pendiente ?? 0);
  const [montoCup, setMontoCup] = useState("");
  const [montoUsd, setMontoUsd] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [tasaCambio, setTasaCambio] = useState<number | null>(null);
  const [tasaLoading, setTasaLoading] = useState(true);
  const [tasaError, setTasaError] = useState<string | null>(null);
  const [pagoLoading, setPagoLoading] = useState(false);
  const [pagoError, setPagoError] = useState<string | null>(null);

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
    totalPagadoCup > total + 0.005
      ? redondear2(totalPagadoCup - total)
      : 0;
  const restante = Math.max(0, redondear2(total - totalPagadoCup));
  const faltaPago = totalPagadoCup > 0 && totalPagadoCup + 0.005 < total;

  useEffect(() => {
    let activo = true;

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

        if (activo) {
          setTasaCambio(tasa);
        }
      } catch (requestError) {
        if (activo) {
          setTasaCambio(null);
          setTasaError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar la tasa de cambio.",
          );
        }
      } finally {
        if (activo) {
          setTasaLoading(false);
        }
      }
    }

    void cargarTasaCambio();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pagoLoading) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pagoLoading, onClose]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    if (faltaPago) {
      setPagoError(`Faltan ${money(total - totalPagadoCup)} CUP para pagar el lote.`);
      return;
    }

    setPagoLoading(true);

    try {
      const data = await apiFetch<PagoLoteData>(
        `proveedores/lotes/${lote.id}/pagar/`,
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

      onPagado(Number(data.vuelto_cup ?? 0));
    } catch (requestError) {
      setPagoError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo pagar el lote.",
      );
    } finally {
      setPagoLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pagoLoading) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pagar-lote-modal-title"
        className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id="pagar-lote-modal-title"
              className="flex items-center gap-2 text-lg font-extrabold text-ink"
            >
              <Wallet className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              Pagar lote
            </h2>
            <p className="mt-1 text-sm text-muted">
              {lote.numero} · {lote.tipo_label}
            </p>
            <p className="mt-1 text-sm text-muted">
              Total pendiente: <strong className="text-ink">{money(total)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="lote-monto-cup"
                className="mb-1.5 block text-sm font-semibold text-ink"
              >
                Monto en CUP
              </label>
              <input
                id="lote-monto-cup"
                name="lote-monto-cup"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={montoCup}
                onChange={(event) => handleMontoCupChange(event.target.value)}
                disabled={pagoLoading}
                placeholder="0.00"
                autoComplete="off"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label
                htmlFor="lote-monto-usd"
                className="mb-1.5 block text-sm font-semibold text-ink"
              >
                Monto en USD (entero)
              </label>
              <input
                id="lote-monto-usd"
                name="lote-monto-usd"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={montoUsd}
                onChange={(event) => handleMontoUsdChange(event.target.value)}
                disabled={pagoLoading}
                placeholder="0"
                autoComplete="off"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="lote-metodo-pago"
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Método
            </label>
            <select
              id="lote-metodo-pago"
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
                Vuelto a entregar: <strong>{money(vueltoCup)} CUP</strong>
              </span>
            </div>
          ) : null}

          {faltaPago ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Faltan <strong>{money(total - totalPagadoCup)} CUP</strong> para
                pagar el lote completo.
              </span>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {pagoLoading ? "Procesando..." : "Pagar lote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

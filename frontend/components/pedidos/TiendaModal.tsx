"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { redondear2 } from "@/lib/costos";
import { money } from "@/lib/format";

type TiendaModalProps = {
  pedidoId: number;
  precio: number;
  onClose: () => void;
};

export default function TiendaModal({
  pedidoId,
  precio,
  onClose,
}: TiendaModalProps) {
  const router = useRouter();
  const [montoCup, setMontoCup] = useState("");
  const [montoUsd, setMontoUsd] = useState("");
  const [moneda, setMoneda] = useState<"CUP" | "USD">("CUP");
  const [tasaCambio, setTasaCambio] = useState<number | null>(null);
  const [tasaError, setTasaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const montoCupNumero = Number(montoCup || 0);
  const montoUsdNumero = Number(montoUsd || 0);
  const usaUsd = moneda === "USD";
  
  const montoValido = usaUsd
    ? Number.isInteger(montoUsdNumero) && montoUsdNumero > 0
    : montoCupNumero > 0;
    
  const tasaValida =
    tasaCambio !== null && Number.isFinite(tasaCambio) && tasaCambio > 0;
    
  const montoCupEquiv = usaUsd
    ? redondear2(montoUsdNumero * (tasaCambio ?? 0))
    : montoCupNumero;
    
  const vuelto = redondear2(Math.max(0, montoCupEquiv - precio));

  // NUEVO: Calcula el precio sugerido en USD redondeando hacia arriba
  const precioSugeridoUsd = tasaCambio ? Math.ceil(precio / tasaCambio) : 0;

  useEffect(() => {
    let cancelado = false;

    async function cargarTasa() {
      try {
        const data = await apiFetch<{ tasa_cambio: number }>(
          "pedidos/tasa-cambio/",
        );
        const tasa = Number(data.tasa_cambio);

        if (cancelado) {
          return;
        }

        if (!Number.isFinite(tasa) || tasa <= 0) {
          throw new Error("La tasa de cambio configurada no es válida.");
        }

        setTasaCambio(tasa);
        setTasaError(null);
      } catch (requestError) {
        if (cancelado) {
          return;
        }

        setTasaCambio(null);
        setTasaError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar la tasa de cambio.",
        );
      }
    }

    void cargarTasa();

    return () => {
      cancelado = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    if (!montoValido) {
      setError("Indica un monto mayor que cero.");
      return;
    }

    if (usaUsd && !tasaValida) {
      setError("No hay una tasa de cambio válida para el pago en USD.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<unknown>(`tienda/${pedidoId}/vender/`, {
        method: "POST",
        body: JSON.stringify({
          monto_cup: usaUsd ? 0 : montoCupNumero,
          monto_usd: usaUsd ? montoUsdNumero : 0,
          tasa_aplicada: usaUsd ? tasaCambio : null,
          metodo: "EFECTIVO",
        }),
      });

      setSuccess("Venta registrada correctamente.");
      onClose();
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar la venta.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tienda-vender-title"
        className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id="tienda-vender-title"
              className="text-lg font-extrabold text-ink"
            >
              Vender libro
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pedido #{pedidoId} · Precio: {money(precio)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {success ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{success}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold text-ink">
                Moneda de pago
              </label>
              <div className="inline-flex rounded-md border border-line bg-white p-0.5">
                {(["CUP", "USD"] as const).map((monedaOption) => (
                  <button
                    key={monedaOption}
                    type="button"
                    onClick={() => setMoneda(monedaOption)}
                    aria-pressed={moneda === monedaOption}
                    className={`rounded px-2 py-0.5 text-xs font-bold transition ${
                      moneda === monedaOption
                        ? "bg-brand text-white"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {monedaOption}
                  </button>
                ))}
              </div>
            </div>

            {moneda === "CUP" ? (
              <label
                htmlFor="tienda-monto-cup"
                className="mb-1.5 block text-sm font-semibold text-ink"
              >
                Monto en CUP
              </label>
            ) : null}

            {moneda === "CUP" ? (
              <input
                id="tienda-monto-cup"
                name="monto-cup"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={montoCup}
                onChange={(event) => setMontoCup(event.target.value)}
                disabled={loading}
                placeholder="0.00"
                autoComplete="off"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
              />
            ) : null}

            {moneda === "USD" ? (
              <label
                htmlFor="tienda-monto-usd"
                className="mb-1.5 block text-sm font-semibold text-ink"
              >
                Monto en USD (entero)
              </label>
            ) : null}

            {moneda === "USD" ? (
              <input
                id="tienda-monto-usd"
                name="monto-usd"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={montoUsd}
                onChange={(event) =>
                  setMontoUsd(event.target.value.replace(/\D/g, ""))
                }
                disabled={loading}
                placeholder={precioSugeridoUsd > 0 ? String(precioSugeridoUsd) : "5"}
                autoComplete="off"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
              />
            ) : null}

            <div className="mt-3 space-y-2 text-sm text-muted">
              <div>
                <span className="font-semibold text-ink">Precio:</span>{" "}
                {money(precio)}
              </div>
              
              {/* NUEVO: Mostrar precio sugerido en USD cuando se paga en USD */}
              {usaUsd && tasaValida && (
                <div>
                  <span className="font-semibold text-ink">Precio sugerido en USD:</span>{" "}
                  {precioSugeridoUsd} USD
                </div>
              )}

              <div>
                <span className="font-semibold text-ink">Monto equivalente:</span>{" "}
                {money(montoCupEquiv)}
              </div>
              <div>
                <span className="font-semibold text-ink">Vuelto a entregar:</span>{" "}
                {money(vuelto)}
              </div>
            </div>

            {usaUsd && !tasaValida ? (
              <p className="text-xs text-amber-700">{tasaError}</p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{loading ? "Registrando..." : "Confirmar venta"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
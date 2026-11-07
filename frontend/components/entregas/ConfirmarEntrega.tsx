"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { redondear2 } from "@/lib/costos";
import { money, number } from "@/lib/format";
import { METODOS_PAGO } from "@/lib/pedidos";

type ConfirmarEntregaProps = {
  entregaId: number;
  clienteNombre: string;
  totalACobrar: number;
  saldoPedidos: number;
  costoMensajeria: number;
};

export default function ConfirmarEntrega({
  entregaId,
  clienteNombre,
  totalACobrar,
  saldoPedidos,
  costoMensajeria,
}: ConfirmarEntregaProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moneda, setMoneda] = useState<"CUP" | "USD">("CUP");
  const [montoCup, setMontoCup] = useState("");
  const [montoUsd, setMontoUsd] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [tasaCambio, setTasaCambio] = useState<number | null>(null);
  const [tasaError, setTasaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoCupNumero = Number(montoCup || 0);
  const montoUsdNumero = Number(montoUsd || 0);
  const usaUsd = moneda === "USD";
  const sinCobro = totalACobrar <= 0.005;

  const montoValido =
    sinCobro ||
    (usaUsd
      ? Number.isInteger(montoUsdNumero) && montoUsdNumero > 0
      : montoCupNumero > 0);

  const tasaValida =
    tasaCambio !== null && Number.isFinite(tasaCambio) && tasaCambio > 0;

  const montoCupEquiv = usaUsd
    ? redondear2(montoUsdNumero * (tasaCambio ?? 0))
    : montoCupNumero;

  const excedente = sinCobro
    ? 0
    : redondear2(Math.max(0, montoCupEquiv - totalACobrar));
  const faltante = sinCobro ? 0 : redondear2(Math.max(0, totalACobrar - montoCupEquiv));
  const precioSugeridoUsd =
    tasaCambio && tasaCambio > 0 ? Math.ceil(totalACobrar / tasaCambio) : 0;

  useEffect(() => {
    if (!open) {
      return;
    }

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
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [loading, open]);

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

    if (!sinCobro && montoCupEquiv + 0.005 < totalACobrar) {
      setError(`Faltan ${money(faltante)} para cubrir el total de la entrega.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch<unknown>(`entregas/${entregaId}/confirmar/`, {
        method: "POST",
        body: JSON.stringify({
          monto_cup: sinCobro || usaUsd ? 0 : redondear2(montoCupNumero),
          monto_usd: sinCobro || !usaUsd ? 0 : montoUsdNumero,
          tasa_aplicada: sinCobro || !usaUsd ? null : tasaCambio,
          metodo,
        }),
      });

      setOpen(false);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo confirmar la entrega.",
      );
    } finally {
      setLoading(false);
    }
  }

  function cerrar() {
    if (!loading) {
      setOpen(false);
      setError(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        <Truck className="h-4 w-4" />
        Confirmar entrega
      </button>

      {open ? (
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
            aria-labelledby="confirmar-entrega-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="confirmar-entrega-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Confirmar entrega #{entregaId}
                </h2>
                <p className="mt-1 text-sm text-muted">{clienteNombre}</p>
              </div>
              <button
                type="button"
                onClick={cerrar}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Saldo de pedidos</span>
                  <span className="font-semibold text-ink">
                    {money(saldoPedidos)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted">Mensajería</span>
                  <span className="font-semibold text-ink">
                    {money(costoMensajeria)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                  <span className="font-semibold text-ink">Total a cobrar</span>
                  <span className="font-extrabold text-ink">
                    {money(totalACobrar)}
                  </span>
                </div>
              </div>

              {sinCobro ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Esta entrega no tiene saldo pendiente. Puedes confirmarla
                  directamente.
                </p>
              ) : (
                <>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-sm font-semibold text-ink">
                        Moneda de pago
                      </label>
                      <div className="inline-flex rounded-md border border-line bg-white p-0.5">
                        {(["CUP", "USD"] as const).map((opcion) => (
                          <button
                            key={opcion}
                            type="button"
                            onClick={() => setMoneda(opcion)}
                            aria-pressed={moneda === opcion}
                            className={`rounded px-2 py-0.5 text-xs font-bold transition ${
                              moneda === opcion
                                ? "bg-brand text-white"
                                : "text-muted hover:text-ink"
                            }`}
                          >
                            {opcion}
                          </button>
                        ))}
                      </div>
                    </div>

                    {moneda === "CUP" ? (
                      <>
                        <label
                          htmlFor="entrega-monto-cup"
                          className="mb-1.5 block text-sm font-semibold text-ink"
                        >
                          Monto en CUP
                        </label>
                        <input
                          id="entrega-monto-cup"
                          name="monto-cup"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={montoCup}
                          onChange={(event) => setMontoCup(event.target.value)}
                          disabled={loading}
                          placeholder={totalACobrar.toFixed(2)}
                          autoComplete="off"
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                        />
                      </>
                    ) : (
                      <>
                        <label
                          htmlFor="entrega-monto-usd"
                          className="mb-1.5 block text-sm font-semibold text-ink"
                        >
                          Monto en USD (entero)
                        </label>
                        <input
                          id="entrega-monto-usd"
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
                          placeholder={
                            precioSugeridoUsd > 0
                              ? String(precioSugeridoUsd)
                              : "5"
                          }
                          autoComplete="off"
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                        />
                      </>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="entrega-metodo"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Método de pago
                    </label>
                    <select
                      id="entrega-metodo"
                      name="metodo"
                      value={metodo}
                      onChange={(event) => setMetodo(event.target.value)}
                      disabled={loading}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                    >
                      {METODOS_PAGO.map((opcion) => (
                        <option key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 text-sm text-muted">
                    {usaUsd && tasaValida ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink">
                            Precio sugerido en USD
                          </span>
                          <span>{precioSugeridoUsd} USD</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink">Tasa</span>
                          <span>{tasaCambio} CUP/USD</span>
                        </div>
                      </>
                    ) : null}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">
                        Monto equivalente
                      </span>
                      <span>{money(montoCupEquiv)}</span>
                    </div>
                    {faltante > 0 ? (
                      <div className="flex items-center justify-between text-amber-700">
                        <span className="font-semibold">Falta por cubrir</span>
                        <span>{money(faltante)}</span>
                      </div>
                    ) : null}
                    {excedente > 0 ? (
                      <p
                        className={`rounded-lg border px-3 py-2 ${
                          usaUsd
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {usaUsd
                          ? `Vuelto a entregar: ${number(excedente)} CUP`
                          : `El excedente de ${number(excedente)} CUP se registrará como propina.`}
                      </p>
                    ) : null}
                  </div>

                  {usaUsd && !tasaValida ? (
                    <p className="text-xs text-amber-700">{tasaError}</p>
                  ) : null}
                </>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  <span>
                    {loading ? "Confirmando..." : "Confirmar entrega"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={cerrar}
                  disabled={loading}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

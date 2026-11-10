"use client";

import { AlertCircle, Loader2, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { money, number } from "@/lib/format";
import {
  CONCEPTOS_PAGO,
  MONEDAS_PAGO,
  type Empleado,
  type Moneda,
  type PagoEmpleadoData,
  type PagoTipo,
  type UtilidadesDisponibles,
} from "@/lib/empleados";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export default function PagoModal({
  empleados,
  empleadoInicialId,
  tasaActual,
  onClose,
  onPagado,
}: {
  empleados: Empleado[];
  empleadoInicialId?: number;
  tasaActual: number;
  onClose: () => void;
  onPagado: () => void;
}) {
  const [empleadoId, setEmpleadoId] = useState(
    String(empleadoInicialId ?? empleados[0]?.id ?? ""),
  );
  const [concepto, setConcepto] = useState<PagoTipo>("SALARIO");
  const [moneda, setMoneda] = useState<Moneda>("CUP");
  const [monto, setMonto] = useState("");
  const [tasa, setTasa] = useState(
    tasaActual > 0 ? String(tasaActual) : "",
  );
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [utilidades, setUtilidades] = useState<UtilidadesDisponibles | null>(
    null,
  );
  const [utilidadesLoading, setUtilidadesLoading] = useState(true);
  const [utilidadesError, setUtilidadesError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    apiFetch<UtilidadesDisponibles>("empleados/utilidades-disponibles/")
      .then((data) => {
        if (!activo) {
          return;
        }
        setUtilidades(data);
        if (data.tasa_actual > 0) {
          setTasa((actual) => actual || String(data.tasa_actual));
        }
      })
      .catch((requestError: unknown) => {
        if (!activo) {
          return;
        }
        setUtilidades(null);
        setUtilidadesError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron calcular las utilidades disponibles.",
        );
      })
      .finally(() => {
        if (activo) {
          setUtilidadesLoading(false);
        }
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !guardando) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [guardando, onClose]);

  const montoNumero = Number(monto || 0);
  const tasaNumero = Number(tasa || 0);
  const usaUsd = moneda === "USD";
  const limite = usaUsd
    ? utilidades?.disponible_usd
    : utilidades?.disponible_cup;
  const montoUsdEntero = !usaUsd || Number.isInteger(montoNumero);
  const tasaValida = !usaUsd || (Number.isFinite(tasaNumero) && tasaNumero > 0);

  const textoUtilidades = useMemo(() => {
    if (utilidadesLoading) {
      return "Calculando utilidades disponibles…";
    }
    if (utilidadesError) {
      return `No se pudieron calcular las utilidades: ${utilidadesError}`;
    }
    if (!utilidades) {
      return "No hay información de utilidades disponible.";
    }
    return `Máx. en CUP: ${money(utilidades.disponible_cup)} | Máx. en USD: ${money(utilidades.disponible_usd, "USD")}`;
  }, [utilidades, utilidadesError, utilidadesLoading]);

  function cambiarMoneda(value: Moneda) {
    setMoneda(value);
    setMonto("");
    setError(null);
    if (value === "USD" && !tasa && utilidades?.tasa_actual) {
      setTasa(String(utilidades.tasa_actual));
    }
  }

  function handleMontoChange(value: string) {
    if (moneda === "USD") {
      setMonto(value.replace(/\D/g, ""));
    } else {
      const limpio = value.replace(/[^\d.]/g, "");
      const [entero, ...decimales] = limpio.split(".");
      setMonto(
        decimales.length > 0
          ? `${entero}.${decimales.join("").slice(0, 2)}`
          : entero,
      );
    }
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) {
      return;
    }

    if (!empleadoId) {
      setError("Selecciona un empleado.");
      return;
    }
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      setError("El monto debe ser mayor que cero.");
      return;
    }
    if (!montoUsdEntero) {
      setError("Los pagos en USD deben ser un monto entero, sin centavos.");
      return;
    }
    if (!tasaValida) {
      setError("Indica una tasa de cambio válida para el pago en USD.");
      return;
    }
    if (concepto === "UTILIDADES") {
      if (utilidadesLoading) {
        setError("Espera a que se calculen las utilidades disponibles.");
        return;
      }
      if (utilidadesError || !utilidades) {
        setError("No se pudieron verificar las utilidades disponibles.");
        return;
      }
      if (typeof limite !== "number") {
        setError(`No hay disponible configurado en ${moneda}.`);
        return;
      }
      if (montoNumero > limite + 0.005) {
        setError(
          `El máximo disponible en ${moneda} es ${money(limite, moneda)}.`,
        );
        return;
      }
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch<PagoEmpleadoData>(`empleados/${empleadoId}/pagar/`, {
        method: "POST",
        body: JSON.stringify({
          monto: montoNumero,
          moneda,
          tasa: usaUsd ? tasaNumero : null,
          concepto: concepto === "UTILIDADES" ? "RETIRO_UTILIDADES" : "SALARIO",
          metodo,
        }),
      });
      onPagado();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar el pago.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !guardando) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pago-empleado-modal-title"
        className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id="pago-empleado-modal-title"
              className="flex items-center gap-2 text-lg font-extrabold text-ink"
            >
              <Wallet className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              Registrar pago
            </h2>
            <p className="mt-1 text-sm text-muted">
              Registra salarios o retiros de utilidades del negocio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
            <label htmlFor="pago-empleado" className={labelClass}>
              Empleado *
            </label>
            <select
              id="pago-empleado"
              value={empleadoId}
              onChange={(event) => setEmpleadoId(event.target.value)}
              disabled={guardando}
              className={inputClass}
            >
              {empleados.map((empleado) => (
                <option key={empleado.id} value={empleado.id}>
                  {empleado.nombre} · {empleado.cargo_label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pago-concepto" className={labelClass}>
              Concepto *
            </label>
            <select
              id="pago-concepto"
              value={concepto}
              onChange={(event) => {
                setConcepto(event.target.value as PagoTipo);
                setError(null);
              }}
              disabled={guardando}
              className={inputClass}
            >
              {CONCEPTOS_PAGO.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelClass}>Moneda *</span>
            <div className="grid grid-cols-2 gap-2">
              {MONEDAS_PAGO.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => cambiarMoneda(item.value)}
                  disabled={guardando}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    moneda === item.value
                      ? "border-brand bg-blue-50 text-brand"
                      : "border-line bg-white text-muted hover:border-brand hover:text-brand"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pago-monto" className={labelClass}>
                Monto ({moneda}) *
              </label>
              <input
                id="pago-monto"
                type="text"
                inputMode="decimal"
                value={monto}
                onChange={(event) => handleMontoChange(event.target.value)}
                disabled={guardando}
                required
                autoFocus
                className={inputClass}
                placeholder={moneda === "USD" ? "0" : "0.00"}
              />
            </div>
            <div>
              <label htmlFor="pago-metodo" className={labelClass}>
                Método
              </label>
              <select
                id="pago-metodo"
                value={metodo}
                onChange={(event) => setMetodo(event.target.value)}
                disabled={guardando}
                className={inputClass}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          {usaUsd ? (
            <div>
              <label htmlFor="pago-tasa" className={labelClass}>
                Tasa de cambio (CUP/USD) *
              </label>
              <input
                id="pago-tasa"
                type="number"
                inputMode="decimal"
                min="0.0001"
                step="0.0001"
                value={tasa}
                onChange={(event) => setTasa(event.target.value)}
                disabled={guardando}
                required
                className={inputClass}
                placeholder="Tasa actual"
              />
            </div>
          ) : null}

          {concepto === "UTILIDADES" ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                utilidadesError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-sky-200 bg-sky-50 text-sky-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {utilidadesLoading ? (
                  <Loader2
                    className="mt-0.5 h-4 w-4 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{textoUtilidades}</span>
              </div>
              {utilidades ? (
                <div className="mt-1 text-xs opacity-80">
                  Tasa actual: {number(utilidades.tasa_actual)} CUP/USD.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Registrar pago
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

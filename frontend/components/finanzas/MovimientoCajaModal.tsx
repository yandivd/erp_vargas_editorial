"use client";

import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import {
  CATEGORIAS_GASTO_MANUAL,
  CATEGORIAS_INGRESO_MANUAL,
  METODOS_CAJA,
  MONEDAS_CAJA,
  type MonedaCaja,
  type MovimientoCajaResponse,
  type TipoMovimientoCaja,
} from "@/lib/finanzas";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export default function MovimientoCajaModal({
  tipo,
}: {
  tipo: TipoMovimientoCaja;
}) {
  const router = useRouter();
  const esIngreso = tipo === "INGRESO";
  const categorias = esIngreso
    ? CATEGORIAS_INGRESO_MANUAL
    : CATEGORIAS_GASTO_MANUAL;
  const [abierto, setAbierto] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<MonedaCaja>("CUP");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [categoria, setCategoria] = useState(categorias[0].value);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setConcepto("");
    setMonto("");
    setMoneda("CUP");
    setMetodo("EFECTIVO");
    setCategoria(categorias[0].value);
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

    const montoNumero = Number(monto);
    if (!concepto.trim()) {
      setError("El concepto es obligatorio.");
      return;
    }
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      setError("El monto debe ser un número mayor que cero.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch<MovimientoCajaResponse>("finanzas/caja/movimiento/", {
        method: "POST",
        body: JSON.stringify({
          tipo,
          categoria,
          monto: montoNumero,
          moneda,
          metodo,
          concepto: concepto.trim(),
        }),
      });

      setAbierto(false);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar el movimiento.",
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
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
          esIngreso
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {esIngreso ? (
          <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ArrowDownCircle className="h-4 w-4" aria-hidden="true" />
        )}
        {esIngreso ? "Nuevo Ingreso" : "Nuevo Gasto"}
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
            aria-labelledby="movimiento-caja-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="movimiento-caja-title"
                  className="text-lg font-extrabold text-ink"
                >
                  {esIngreso ? "Nuevo ingreso" : "Nuevo gasto"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {esIngreso
                    ? "Registra un ingreso manual en la caja."
                    : "Registra una salida manual de la caja."}
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
                <label htmlFor="caja-concepto" className={labelClass}>
                  Concepto *
                </label>
                <input
                  id="caja-concepto"
                  type="text"
                  value={concepto}
                  onChange={(event) => setConcepto(event.target.value)}
                  disabled={guardando}
                  required
                  autoFocus
                  className={inputClass}
                  placeholder={
                    esIngreso ? "Ej. Propina de cliente" : "Ej. Pago de luz"
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="caja-monto" className={labelClass}>
                    Monto *
                  </label>
                  <input
                    id="caja-monto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={monto}
                    onChange={(event) => setMonto(event.target.value)}
                    disabled={guardando}
                    required
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label htmlFor="caja-moneda" className={labelClass}>
                    Moneda
                  </label>
                  <select
                    id="caja-moneda"
                    value={moneda}
                    onChange={(event) =>
                      setMoneda(event.target.value as MonedaCaja)
                    }
                    disabled={guardando}
                    className={inputClass}
                  >
                    {MONEDAS_CAJA.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="caja-categoria" className={labelClass}>
                    Categoría
                  </label>
                  <select
                    id="caja-categoria"
                    value={categoria}
                    onChange={(event) => setCategoria(event.target.value)}
                    disabled={guardando}
                    className={inputClass}
                  >
                    {categorias.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="caja-metodo" className={labelClass}>
                    Método
                  </label>
                  <select
                    id="caja-metodo"
                    value={metodo}
                    onChange={(event) => setMetodo(event.target.value)}
                    disabled={guardando}
                    className={inputClass}
                  >
                    {METODOS_CAJA.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                    esIngreso
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {guardando
                    ? "Guardando..."
                    : esIngreso
                      ? "Guardar ingreso"
                      : "Guardar gasto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

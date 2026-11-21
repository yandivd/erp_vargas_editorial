"use client";

import { AlertCircle, Loader2, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { number } from "@/lib/format";
import type {
  InventarioMaterial,
  InventarioMovimientoResponse,
} from "@/lib/inventario";

type AjusteStockModalProps = {
  material: InventarioMaterial;
};

export default function AjusteStockModal({ material }: AjusteStockModalProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [stockReal, setStockReal] = useState("0");
  const [motivo, setMotivo] = useState("");
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
    setStockReal(String(material.stock_actual));
    setMotivo("");
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

    const stockNumero = Number(stockReal);

    if (!Number.isFinite(stockNumero) || stockNumero < 0) {
      setError("El stock real debe ser un número mayor o igual a cero.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch<InventarioMovimientoResponse["data"]>(
        "inventario/movimiento",
        {
          method: "POST",
          body: JSON.stringify({
            material_id: material.id,
            tipo: "AJUSTE",
            cantidad: stockNumero,
            motivo: motivo.trim() || "Ajuste de inventario",
          }),
        },
      );

      setAbierto(false);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar el ajuste.",
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
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Ajustar
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
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
            aria-labelledby="ajuste-stock-title"
            className="my-auto w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="ajuste-stock-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Ajustar stock
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {material.nombre} · Actual:{" "}
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
                  htmlFor="ajuste-stock-real"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Stock real ({material.unidad_medida}) *
                </label>
                <input
                  id="ajuste-stock-real"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={stockReal}
                  onChange={(event) => setStockReal(event.target.value)}
                  disabled={guardando}
                  required
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                />
                <p className="mt-1 text-xs text-muted">
                  El stock se fijará exactamente en este valor.
                </p>
              </div>

              <div>
                <label
                  htmlFor="ajuste-stock-motivo"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Motivo
                </label>
                <input
                  id="ajuste-stock-motivo"
                  type="text"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  disabled={guardando}
                  placeholder="Ej: conteo físico"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                />
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
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  )}
                  {guardando ? "Ajustando..." : "Guardar ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

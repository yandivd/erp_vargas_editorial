"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { moneyCaja, type ArqueoResponse } from "@/lib/finanzas";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

type Paso = "form" | "confirmar";

function valorNumero(value: string): number {
  if (!value.trim()) {
    return 0;
  }

  return Number(value);
}

function signoDiferencia(value: number): string {
  if (value === 0) {
    return "Cuadró";
  }

  return `${value > 0 ? "+" : "−"}${moneyCaja(Math.abs(value), "CUP")}`;
}

export default function ArqueoModal({
  saldoCup,
  saldoUsd,
}: {
  saldoCup: number;
  saldoUsd: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>("form");
  const [efectivoCup, setEfectivoCup] = useState("");
  const [efectivoUsd, setEfectivoUsd] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cupContado = valorNumero(efectivoCup);
  const usdContado = valorNumero(efectivoUsd);
  const diferenciaCup = cupContado - saldoCup;
  const diferenciaUsd = usdContado - saldoUsd;
  const hayDiferencia = diferenciaCup !== 0 || diferenciaUsd !== 0;

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
    setPaso("form");
    setEfectivoCup("");
    setEfectivoUsd("");
    setNotas("");
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!Number.isFinite(cupContado) || cupContado < 0) {
      setError("El efectivo en CUP debe ser un número mayor o igual a cero.");
      return;
    }
    if (!Number.isFinite(usdContado) || usdContado < 0) {
      setError("El efectivo en USD debe ser un número mayor o igual a cero.");
      return;
    }

    setError(null);
    setPaso("confirmar");
  }

  async function confirmarArqueo() {
    if (guardando) {
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch<ArqueoResponse>("finanzas/arqueo/", {
        method: "POST",
        body: JSON.stringify({
          efectivo_cup: cupContado,
          efectivo_usd: usdContado,
          notas: notas.trim(),
        }),
      });

      setAbierto(false);
      router.push("/finanzas/arqueos");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar el arqueo.",
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
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        Hacer Arqueo
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
            aria-labelledby="arqueo-caja-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="arqueo-caja-title"
                  className="text-lg font-extrabold text-ink"
                >
                  {paso === "form" ? "Arqueo de caja" : "Confirmar arqueo"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {paso === "form"
                    ? "Cuenta el efectivo físico por moneda."
                    : "Revisa las diferencias antes de registrar el cierre."}
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

            {paso === "form" ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-line bg-slate-50 px-3 py-2">
                    <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                      Sistema CUP
                    </div>
                    <div className="mt-0.5 font-bold text-ink">
                      {moneyCaja(saldoCup, "CUP")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-line bg-slate-50 px-3 py-2">
                    <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                      Sistema USD
                    </div>
                    <div className="mt-0.5 font-bold text-ink">
                      {moneyCaja(saldoUsd, "USD")}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="arqueo-cup" className={labelClass}>
                      Efectivo en CUP *
                    </label>
                    <input
                      id="arqueo-cup"
                      type="number"
                      min="0"
                      step="0.01"
                      value={efectivoCup}
                      onChange={(event) => setEfectivoCup(event.target.value)}
                      disabled={guardando}
                      required
                      autoFocus
                      className={inputClass}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label htmlFor="arqueo-usd" className={labelClass}>
                      Efectivo en USD *
                    </label>
                    <input
                      id="arqueo-usd"
                      type="number"
                      min="0"
                      step="0.01"
                      value={efectivoUsd}
                      onChange={(event) => setEfectivoUsd(event.target.value)}
                      disabled={guardando}
                      required
                      className={inputClass}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="arqueo-notas" className={labelClass}>
                    Notas
                  </label>
                  <textarea
                    id="arqueo-notas"
                    rows={3}
                    value={notas}
                    onChange={(event) => setNotas(event.target.value)}
                    disabled={guardando}
                    className={inputClass}
                    placeholder="Observaciones del conteo..."
                  />
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
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                  >
                    Revisar diferencias
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-line">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-muted">
                          Moneda
                        </th>
                        <th className="px-3 py-2 text-right font-bold text-muted">
                          Esperado
                        </th>
                        <th className="px-3 py-2 text-right font-bold text-muted">
                          Contado
                        </th>
                        <th className="px-3 py-2 text-right font-bold text-muted">
                          Diferencia
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-line">
                        <td className="px-3 py-3 font-semibold">CUP</td>
                        <td className="px-3 py-3 text-right">
                          {moneyCaja(saldoCup, "CUP")}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {moneyCaja(cupContado, "CUP")}
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-bold ${
                            diferenciaCup === 0
                              ? "text-emerald-700"
                              : diferenciaCup > 0
                                ? "text-amber-700"
                                : "text-red-700"
                          }`}
                        >
                          {signoDiferencia(diferenciaCup)}
                        </td>
                      </tr>
                      <tr className="border-t border-line">
                        <td className="px-3 py-3 font-semibold">USD</td>
                        <td className="px-3 py-3 text-right">
                          {moneyCaja(saldoUsd, "USD")}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {moneyCaja(usdContado, "USD")}
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-bold ${
                            diferenciaUsd === 0
                              ? "text-emerald-700"
                              : diferenciaUsd > 0
                                ? "text-amber-700"
                                : "text-red-700"
                          }`}
                        >
                          {diferenciaUsd === 0
                            ? "Cuadró"
                            : `${diferenciaUsd > 0 ? "+" : "−"}${moneyCaja(
                                Math.abs(diferenciaUsd),
                                "USD",
                              )}`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {notas.trim() ? (
                  <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-ink">Notas:</span>{" "}
                    <span className="text-muted">{notas.trim()}</span>
                  </div>
                ) : null}

                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    hayDiferencia
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {hayDiferencia
                      ? "Se registrará automáticamente un movimiento de ajuste por cada moneda con diferencia."
                      : "La caja cuadra perfectamente. No se crearán ajustes."}
                  </span>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setPaso("form")}
                    disabled={guardando}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={confirmarArqueo}
                    disabled={guardando}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {guardando ? "Registrando..." : "Confirmar arqueo"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

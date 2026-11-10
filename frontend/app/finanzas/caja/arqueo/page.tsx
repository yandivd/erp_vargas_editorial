"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Landmark,
  Loader2,
  SearchX,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, apiFetchEnvelope } from "@/lib/api";
import {
  type ArqueoResponse,
  type ArqueosData,
  type CajaResumen,
  type CierreCaja,
} from "@/lib/finanzas";
import { formatDate, money } from "@/lib/format";

const DENOMINACIONES = [
  20000,
  10000,
  5000,
  2000,
  1000,
  500,
  200,
  100,
  50,
  20,
  10,
  5,
  3,
  1,
] as const;

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass =
  "mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted";

type Cantidades = Record<number, string>;

function valorNumerico(value: string | number | undefined): number {
  const numero = Number(value ?? 0);
  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
}

function diferenciaClase(value: number): string {
  if (value === 0) {
    return "text-emerald-600";
  }

  return value > 0 ? "text-amber-600" : "text-red-600";
}

function diferenciaTexto(value: number): string {
  if (value === 0) {
    return money(0);
  }

  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

function HistorialDiferencia({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Cuadró
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        value > 0
          ? "bg-amber-100 text-amber-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {diferenciaTexto(value)}
    </span>
  );
}

function BilleteImagen({ denominacion }: { denominacion: number }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex h-12 w-24 items-center justify-center rounded border border-line bg-slate-100 text-sm font-bold text-muted">
        ${denominacion}
      </div>
    );
  }

  return (
    <Image
      src={`/img/billetes/${denominacion}.jpg`}
      alt={`Billete de ${denominacion} CUP`}
      width={96}
      height={48}
      className="h-12 w-24 rounded border border-line object-cover shadow-sm"
      onError={() => setError(true)}
    />
  );
}

export default function ArqueoCajaPage() {
  const [cantidades, setCantidades] = useState<Cantidades>({});
  const [transferencia, setTransferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [saldoSistema, setSaldoSistema] = useState<number | null>(null);
  const [historial, setHistorial] = useState<CierreCaja[]>([]);
  const [cargandoResumen, setCargandoResumen] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [resumenError, setResumenError] = useState<string | null>(null);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = true;

    async function cargarResumen() {
      try {
        const resumen = await apiFetch<CajaResumen>(
          "finanzas/caja/resumen/",
        );
        if (!ignore) {
          setSaldoSistema(resumen.saldo_actual_cup);
          setResumenError(null);
        }
      } catch (error) {
        if (!ignore) {
          setSaldoSistema(null);
          setResumenError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el saldo del sistema.",
          );
        }
      } finally {
        if (!ignore) {
          setCargandoResumen(false);
        }
      }
    }

    async function cargarHistorial() {
      try {
        const envelope = await apiFetchEnvelope<ArqueosData>(
          "finanzas/arqueos/?page=1&per_page=10",
        );
        if (!ignore) {
          setHistorial(envelope.data.arqueos ?? []);
          setHistorialError(null);
        }
      } catch (error) {
        if (!ignore) {
          setHistorialError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el historial de arqueos.",
          );
        }
      } finally {
        if (!ignore) {
          setCargandoHistorial(false);
        }
      }
    }

    void cargarResumen();
    void cargarHistorial();

    return () => {
      ignore = false;
    };
  }, [reloadKey]);

  const efectivoContado = DENOMINACIONES.reduce(
    (total, denominacion) =>
      total + valorNumerico(cantidades[denominacion]) * denominacion,
    0,
  );
  const transferencias = valorNumerico(transferencia);
  const totalContado = efectivoContado + transferencias;
  const diferencia =
    saldoSistema === null ? 0 : totalContado - saldoSistema;

  function actualizarCantidad(denominacion: number, value: string) {
    setCantidades((actual) => ({
      ...actual,
      [denominacion]: value,
    }));
    setExito(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saldoSistema === null) {
      setSubmitError(
        "No se pudo cargar el saldo del sistema. Recarga la página antes de confirmar.",
      );
      return;
    }

    setEnviando(true);
    setSubmitError(null);
    setExito(null);

    try {
      const resultado = await apiFetch<ArqueoResponse>(
        "finanzas/arqueo/",
        {
          method: "POST",
          body: JSON.stringify({
            efectivo: Number(efectivoContado.toFixed(2)),
            transferencias: Number(transferencias.toFixed(2)),
            notas: notas.trim(),
          }),
        },
      );

      const diferenciaFinal = resultado.arqueo.diferencia_cup;
      setExito(
        diferenciaFinal === 0
          ? "¡La caja cuadró perfectamente!"
          : `Arqueo registrado con una diferencia de ${money(
              Math.abs(diferenciaFinal),
            )}.`,
      );
      setCantidades({});
      setTransferencia("");
      setNotas("");
      setReloadKey((actual) => actual + 1);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el arqueo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <ClipboardCheck className="h-7 w-7 text-brand" aria-hidden="true" />
            Arqueo de Caja
          </h1>
          <p className="mt-1 text-sm text-muted">
            Cuenta el efectivo y verifica contra el sistema.
          </p>
        </div>
        <Link
          href="/finanzas/caja"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a Caja
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
            <div className="mb-4 flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-extrabold text-ink">
                Conteo de Efectivo
              </h2>
              <div className="sm:text-right">
                <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  El sistema dice que hay
                </div>
                <div className="text-xl font-extrabold text-brand">
                  {cargandoResumen
                    ? "Cargando..."
                    : saldoSistema === null
                      ? "—"
                      : money(saldoSistema)}
                </div>
              </div>
            </div>

            {resumenError ? (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{resumenError}</span>
              </div>
            ) : null}

            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <label
                htmlFor="arqueo-transferencia"
                className="flex items-center gap-2 text-sm font-bold text-ink"
              >
                <Landmark className="h-4 w-4 text-brand" aria-hidden="true" />
                Transferencias / Tarjeta
              </label>
              <div className="relative sm:w-48">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
                  $
                </span>
                <input
                  id="arqueo-transferencia"
                  type="number"
                  min="0"
                  step="0.01"
                  value={transferencia}
                  onChange={(event) => {
                    setTransferencia(event.target.value);
                    setExito(null);
                  }}
                  disabled={enviando}
                  className={`${inputClass} pl-7 text-right`}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b-2 border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                      Billete
                    </th>
                    <th className="border-b-2 border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                      Valor
                    </th>
                    <th className="border-b-2 border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                      Cantidad
                    </th>
                    <th className="border-b-2 border-line px-2 py-2 text-right text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DENOMINACIONES.map((denominacion) => {
                    const cantidad = valorNumerico(
                      cantidades[denominacion],
                    );
                    const subtotal = cantidad * denominacion;

                    return (
                      <tr key={denominacion}>
                        <td className="border-b border-line px-2 py-2">
                          <BilleteImagen denominacion={denominacion} />
                        </td>
                        <td className="border-b border-line px-2 py-2 text-sm font-semibold text-muted">
                          ${denominacion}
                        </td>
                        <td className="border-b border-line px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted">
                              x
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              aria-label={`Cantidad de billetes de ${denominacion}`}
                              value={cantidades[denominacion] ?? ""}
                              onChange={(event) =>
                                actualizarCantidad(
                                  denominacion,
                                  event.target.value,
                                )
                              }
                              disabled={enviando}
                              className={`${inputClass} w-24 text-center`}
                              placeholder="0"
                            />
                          </div>
                        </td>
                        <td className="border-b border-line px-2 py-2 text-right text-sm font-bold text-emerald-700">
                          {money(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="h-fit rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6 lg:sticky lg:top-24">
            <h2 className="mb-4 border-b border-line pb-3 text-lg font-extrabold text-ink">
              Resumen
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">Efectivo contado:</span>
                <span className="font-bold text-ink">
                  {money(efectivoContado)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">Transferencias:</span>
                <span className="font-bold text-ink">
                  {money(transferencias)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                <span className="text-muted">Total contado:</span>
                <span className="font-bold text-brand">
                  {money(totalContado)}
                </span>
              </div>
            </div>

            <div className="my-4 rounded-lg border border-line bg-slate-50 px-3 py-4">
              <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                Diferencia
              </div>
              <div
                className={`mt-1 text-2xl font-extrabold ${diferenciaClase(
                  diferencia,
                )}`}
              >
                {saldoSistema === null
                  ? "—"
                  : diferenciaTexto(diferencia)}
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="arqueo-notas" className={labelClass}>
                Notas / Observaciones
              </label>
              <textarea
                id="arqueo-notas"
                rows={3}
                value={notas}
                onChange={(event) => {
                  setNotas(event.target.value);
                  setExito(null);
                }}
                disabled={enviando}
                className={inputClass}
                placeholder="Ej: Faltó vuelto..."
              />
            </div>

            {submitError ? (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{submitError}</span>
              </div>
            ) : null}

            {exito ? (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{exito}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={enviando || saldoSistema === null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              )}
              {enviando ? "Registrando..." : "Confirmar Arqueo"}
            </button>
          </aside>
        </div>
      </form>

      <section className="mt-6 rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-ink">
              Historial de Arqueos
            </h2>
            <p className="mt-1 text-sm text-muted">
              Últimos cierres de caja registrados.
            </p>
          </div>
          <Link
            href="/finanzas/arqueos"
            className="text-sm font-semibold text-brand hover:underline"
          >
            Ver historial completo
          </Link>
        </div>

        {historialError ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{historialError}</span>
          </div>
        ) : cargandoHistorial ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando historial...
          </div>
        ) : historial.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center text-muted">
            <SearchX
              className="mb-3 h-10 w-10 text-slate-300"
              aria-hidden="true"
            />
            <p className="font-semibold text-ink">
              No hay arqueos registrados
            </p>
            <p className="mt-1 text-sm">
              El primer cierre aparecerá aquí al confirmar el arqueo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="whitespace-nowrap border-b-2 border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                    Fecha
                  </th>
                  <th className="whitespace-nowrap border-b-2 border-line px-2 py-2 text-right text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                    Sistema
                  </th>
                  <th className="whitespace-nowrap border-b-2 border-line px-2 py-2 text-right text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                    Real
                  </th>
                  <th className="whitespace-nowrap border-b-2 border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                    Diferencia
                  </th>
                  <th className="hidden border-b-2 border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted md:table-cell">
                    Notas
                  </th>
                  <th className="border-b-2 border-line px-2 py-2 text-right text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody>
                {historial.map((arqueo) => (
                  <tr
                    key={arqueo.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap border-b border-line px-2 py-2.5 text-sm">
                      {formatDate(arqueo.fecha)}
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-2 py-2.5 text-right text-sm text-muted">
                      {money(arqueo.saldo_esperado_cup)}
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-2 py-2.5 text-right text-sm font-bold text-ink">
                      {money(arqueo.saldo_real_cup)}
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-2 py-2.5">
                      <HistorialDiferencia value={arqueo.diferencia_cup} />
                    </td>
                    <td className="hidden max-w-[16rem] border-b border-line px-2 py-2.5 text-sm text-muted md:table-cell">
                      <span className="line-clamp-1">
                        {arqueo.notas || "—"}
                      </span>
                    </td>
                    <td className="border-b border-line px-2 py-2.5 text-right">
                      <Link
                        href={`/finanzas/arqueos/${arqueo.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Ver PDF
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

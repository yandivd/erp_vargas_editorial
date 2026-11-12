"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ExternalLink,
  Eye,
  Gift,
  Loader2,
  Search,
  SlidersHorizontal,
  Stamp,
  X,
} from "lucide-react";
import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { apiFetch } from "@/lib/api";
import type { ClienteListItem, FidelidadCliente } from "@/lib/clientes";
import { money } from "@/lib/format";

type Props = {
  clientes: ClienteListItem[];
};

type AjusteResponse = {
  fidelidad: FidelidadCliente;
};

function fidelidadDe(cliente: ClienteListItem): FidelidadCliente | null {
  return cliente.fidelidad ?? null;
}

export default function FidelidadAdminTable({ clientes }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [clienteEditando, setClienteEditando] =
    useState<ClienteListItem | null>(null);
  const [sellos, setSellos] = useState("0");
  const [bono, setBono] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) {
      return clientes;
    }
    return clientes.filter((cliente) => {
      return (
        cliente.nombre.toLowerCase().includes(term) ||
        cliente.telefono.toLowerCase().includes(term)
      );
    });
  }, [busqueda, clientes]);

  function abrirAjuste(cliente: ClienteListItem) {
    const fidelidad = fidelidadDe(cliente);
    setClienteEditando(cliente);
    setSellos(String(fidelidad?.sellos ?? 0));
    setBono(String(fidelidad?.bono_saldo ?? 0));
    setMotivo("");
    setError(null);
  }

  function cerrarAjuste() {
    if (guardando) {
      return;
    }
    setClienteEditando(null);
    setError(null);
  }

  async function guardarAjuste(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clienteEditando || guardando) {
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch<AjusteResponse>(
        `clientes/${clienteEditando.id}/ajustar-fidelidad/`,
        {
          method: "POST",
          body: JSON.stringify({
            sellos: Number(sellos),
            bono_saldo: Number(bono),
            motivo: motivo.trim(),
          }),
        },
      );
      setClienteEditando(null);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar la tarjeta.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
          <span className="font-bold text-ink">{filtrados.length}</span> tarjeta
          {filtrados.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Sellos</th>
              <th className={thClass}>Bono</th>
              <th className={`${thClass} hidden md:table-cell`}>Estado</th>
              <th className={`${thClass} text-right`}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted">
                  No se encontraron tarjetas de fidelidad.
                </td>
              </tr>
            ) : (
              filtrados.map((cliente) => {
                const fidelidad = fidelidadDe(cliente);
                const meta = fidelidad?.meta ?? 10;
                const sellosActuales = fidelidad?.sellos ?? 0;
                const bonoSaldo = fidelidad?.bono_saldo ?? 0;
                const completo = sellosActuales >= meta;
                const token = fidelidad?.token;

                return (
                  <tr key={cliente.id} className={tableRowClass}>
                    <td className={tdClass}>
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className="font-bold text-ink transition hover:text-brand hover:underline"
                      >
                        {cliente.nombre}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted">
                        {cliente.telefono || "Sin teléfono"}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <Stamp
                          className="h-4 w-4 text-brand"
                          aria-hidden="true"
                        />
                        <span className="font-bold text-ink">
                          {sellosActuales}/{meta}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            completo ? "bg-emerald-500" : "bg-brand"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (sellosActuales / meta) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`inline-flex items-center gap-1.5 font-bold ${
                          bonoSaldo > 0 ? "text-emerald-700" : "text-muted"
                        }`}
                      >
                        <Gift className="h-4 w-4" aria-hidden="true" />
                        {money(bonoSaldo)}
                      </span>
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          bonoSaldo > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : completo
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {bonoSaldo > 0
                          ? "Bono disponible"
                          : completo
                            ? "Tarjeta completa"
                            : "En acumulación"}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirAjuste(cliente)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
                        >
                          <SlidersHorizontal
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Ajustar
                        </button>
                        <Link
                          href={`/clientes/${cliente.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Ver
                        </Link>
                        {token ? (
                          <Link
                            href={`/fidelidad/${token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
                            title="Abrir tarjeta pública"
                          >
                            <ExternalLink
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {clienteEditando ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cerrarAjuste();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ajustar-fidelidad-title"
            className="my-6 w-full max-w-md rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h2
                  id="ajustar-fidelidad-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Ajustar tarjeta
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {clienteEditando.nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarAjuste}
                disabled={guardando}
                className="rounded-lg p-2 text-muted transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={guardarAjuste} className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="fidelidad-sellos"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Sellos
                  </label>
                  <input
                    id="fidelidad-sellos"
                    type="number"
                    min={0}
                    max={10}
                    value={sellos}
                    onChange={(event) => setSellos(event.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="fidelidad-bono"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Saldo del bono
                  </label>
                  <input
                    id="fidelidad-bono"
                    type="number"
                    min={0}
                    step="0.01"
                    value={bono}
                    onChange={(event) => setBono(event.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="fidelidad-motivo"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Motivo del ajuste (opcional)
                </label>
                <input
                  id="fidelidad-motivo"
                  type="text"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Ej. compensación, corrección..."
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarAjuste}
                  disabled={guardando}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {guardando ? "Guardando..." : "Guardar ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

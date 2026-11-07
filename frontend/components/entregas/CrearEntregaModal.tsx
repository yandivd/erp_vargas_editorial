"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { redondear2 } from "@/lib/costos";
import type { EntregaDetail } from "@/lib/entregas";
import { money } from "@/lib/format";
import type { PedidoListItem } from "@/lib/pedidos";

type GrupoCliente = {
  clienteId: number;
  clienteNombre: string;
  pedidos: PedidoListItem[];
};

export default function CrearEntregaModal() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoListItem[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [direccion, setDireccion] = useState("");
  const [costoMensajeria, setCostoMensajeria] = useState("0");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [notas, setNotas] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const seleccionadosPedidos = useMemo(
    () => pedidos.filter((pedido) => seleccionados.has(pedido.id)),
    [pedidos, seleccionados],
  );

  const clienteSeleccionado = seleccionadosPedidos[0] ?? null;
  const totalSeleccionado = redondear2(
    seleccionadosPedidos.reduce(
      (total, pedido) => total + Number(pedido.saldo_pendiente || 0),
      0,
    ),
  );

  const grupos = useMemo(() => {
    const mapa = new Map<number, GrupoCliente>();

    for (const pedido of pedidos) {
      if (pedido.cliente_id === null) {
        continue;
      }

      const grupo = mapa.get(pedido.cliente_id);

      if (grupo) {
        grupo.pedidos.push(pedido);
      } else {
        mapa.set(pedido.cliente_id, {
          clienteId: pedido.cliente_id,
          clienteNombre: pedido.cliente_nombre,
          pedidos: [pedido],
        });
      }
    }

    return Array.from(mapa.values());
  }, [pedidos]);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    let cancelado = false;

    apiFetch<PedidoListItem[]>("entregas/pedidos-disponibles/")
      .then((data) => {
        if (!cancelado) {
          setPedidos(data);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelado) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudieron cargar los pedidos disponibles.",
          );
        }
      })
      .finally(() => {
        if (!cancelado) {
          setCargando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [abierto, recarga]);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !guardando) {
        setAbierto(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [abierto, guardando]);

  function abrirModal() {
    setSeleccionados(new Set());
    setDireccion("");
    setCostoMensajeria("0");
    setFechaEntrega("");
    setNotas("");
    setError(null);
    setPedidos([]);
    setCargando(true);
    setRecarga((valor) => valor + 1);
    setAbierto(true);
  }

  function cerrarModal() {
    if (guardando) {
      return;
    }

    setAbierto(false);
    setError(null);
  }

  function togglePedido(pedido: PedidoListItem) {
    if (guardando) {
      return;
    }

    if (
      !seleccionados.has(pedido.id) &&
      clienteSeleccionado !== null &&
      clienteSeleccionado.cliente_id !== pedido.cliente_id
    ) {
      setError(
        "Todos los pedidos de una entrega deben pertenecer al mismo cliente.",
      );
      return;
    }

    setError(null);
    setSeleccionados((actual) => {
      const siguiente = new Set(actual);

      if (siguiente.has(pedido.id)) {
        siguiente.delete(pedido.id);
      } else {
        siguiente.add(pedido.id);
      }

      return siguiente;
    });
  }

  function toggleGrupo(grupo: GrupoCliente) {
    if (guardando) {
      return;
    }

    if (
      clienteSeleccionado !== null &&
      clienteSeleccionado.cliente_id !== grupo.clienteId
    ) {
      setError(
        "Todos los pedidos de una entrega deben pertenecer al mismo cliente.",
      );
      return;
    }

    setError(null);
    setSeleccionados((actual) => {
      const siguiente = new Set(actual);
      const todosSeleccionados = grupo.pedidos.every((pedido) =>
        siguiente.has(pedido.id),
      );

      for (const pedido of grupo.pedidos) {
        if (todosSeleccionados) {
          siguiente.delete(pedido.id);
        } else {
          siguiente.add(pedido.id);
        }
      }

      return siguiente;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (guardando) {
      return;
    }

    if (seleccionados.size === 0) {
      setError("Selecciona al menos un pedido para crear la entrega.");
      return;
    }

    const clientes = new Set(
      seleccionadosPedidos.map((pedido) => pedido.cliente_id),
    );

    if (clientes.size !== 1) {
      setError(
        "Todos los pedidos de una entrega deben pertenecer al mismo cliente.",
      );
      return;
    }

    const costo = Number(costoMensajeria || 0);

    if (!Number.isFinite(costo) || costo < 0) {
      setError("El costo de mensajería no es válido.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const entrega = await apiFetch<EntregaDetail>("entregas/crear/", {
        method: "POST",
        body: JSON.stringify({
          pedido_ids: Array.from(seleccionados),
          direccion: direccion.trim(),
          costo_mensajeria: redondear2(costo),
          fecha_entrega: fechaEntrega || null,
          notas: notas.trim(),
        }),
      });

      if (!entrega?.id) {
        throw new Error(
          "La entrega se creó, pero no se recibió su identificador.",
        );
      }

      setAbierto(false);
      router.push(`/entregas/${entrega.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear la entrega.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirModal}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
      >
        <Truck className="h-4 w-4" aria-hidden="true" />
        Crear Entrega
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cerrarModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="crear-entrega-title"
            className="my-2 w-full max-w-3xl rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
              <div>
                <h2
                  id="crear-entrega-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Crear entrega
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Selecciona los pedidos listos para entregar.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                disabled={guardando}
                className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-6">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-ink">
                    Cliente
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={clienteSeleccionado?.cliente_nombre ?? ""}
                    placeholder="Se deduce de los pedidos seleccionados..."
                    className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-ink outline-none"
                  />
                  <p className="mt-1 text-xs text-muted">
                    Todos los pedidos deben ser del mismo cliente.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="entrega-fecha"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Fecha de entrega
                  </label>
                  <input
                    id="entrega-fecha"
                    type="date"
                    value={fechaEntrega}
                    onChange={(event) => setFechaEntrega(event.target.value)}
                    disabled={guardando}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="entrega-mensajeria"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Costo de mensajería
                  </label>
                  <input
                    id="entrega-mensajeria"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={costoMensajeria}
                    onChange={(event) => setCostoMensajeria(event.target.value)}
                    disabled={guardando}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="entrega-direccion"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Dirección de entrega
                  </label>
                  <textarea
                    id="entrega-direccion"
                    rows={2}
                    value={direccion}
                    onChange={(event) => setDireccion(event.target.value)}
                    disabled={guardando}
                    placeholder="Dirección a donde se llevará el pedido..."
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="entrega-notas"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Notas
                  </label>
                  <textarea
                    id="entrega-notas"
                    rows={2}
                    value={notas}
                    onChange={(event) => setNotas(event.target.value)}
                    disabled={guardando}
                    placeholder="Notas adicionales..."
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <section>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-ink">
                      Pedidos listos para entregar
                    </h3>
                    <p className="text-xs text-muted">
                      {seleccionados.size} seleccionado
                      {seleccionados.size === 1 ? "" : "s"} ·{" "}
                      {money(totalSeleccionado)} en saldos
                    </p>
                  </div>
                  {cargando ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      Cargando...
                    </span>
                  ) : null}
                </div>

                <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
                  {cargando && pedidos.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Buscando pedidos disponibles...
                    </div>
                  ) : grupos.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-muted">
                      No hay pedidos en estado &quot;Listo para Entregar&quot;.
                    </div>
                  ) : (
                    grupos.map((grupo) => {
                      const otroCliente =
                        clienteSeleccionado !== null &&
                        clienteSeleccionado.cliente_id !== grupo.clienteId;
                      const todosSeleccionados = grupo.pedidos.every((pedido) =>
                        seleccionados.has(pedido.id),
                      );

                      return (
                        <div
                          key={grupo.clienteId}
                          className="border-b border-line last:border-b-0"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                            <span className="text-sm font-bold text-ink">
                              {grupo.clienteNombre}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleGrupo(grupo)}
                              disabled={guardando || otroCliente}
                              className="text-xs font-semibold text-brand transition hover:text-brand-dark disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              {todosSeleccionados
                                ? "Quitar todos"
                                : "Seleccionar todos"}
                            </button>
                          </div>

                          <div className="divide-y divide-line">
                            {grupo.pedidos.map((pedido) => (
                              <label
                                key={pedido.id}
                                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50 ${
                                  otroCliente
                                    ? "cursor-not-allowed opacity-50"
                                    : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={seleccionados.has(pedido.id)}
                                  onChange={() => togglePedido(pedido)}
                                  disabled={guardando || otroCliente}
                                  className="h-4 w-4 shrink-0 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-ink">
                                    {pedido.libro_titulo || "Sin título"}
                                  </span>
                                  <span className="block text-xs text-muted">
                                    #{pedido.referencia_externa ?? pedido.id} ·{" "}
                                    {pedido.cantidad} ejemplar
                                    {pedido.cantidad === 1 ? "" : "es"}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block text-sm font-bold text-ink">
                                    {money(pedido.saldo_pendiente)}
                                  </span>
                                  <span className="block text-xs text-muted">
                                    saldo
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={guardando}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || seleccionados.size === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Truck className="h-4 w-4" aria-hidden="true" />
                  )}
                  {guardando ? "Creando..." : "Crear entrega"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

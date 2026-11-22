"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { fetchCatalogoLibro, type LibroPublico } from "@/lib/catalogos";
import { money } from "@/lib/format";
import { PROVINCIAS, municipiosDe } from "@/lib/lugares";
import { costoMensajeriaDe, setTarifasMensajeria } from "@/lib/mensajeria";
import { apiFetch } from "@/lib/api";
import { precioItemCup, precioItemUsd, useCarrito } from "@/lib/tienda";

const WHATSAPP_NUMERO = "5354545068";

type Formulario = {
  nombre: string;
  telefono: string;
  provincia: string;
  municipio: string;
  direccion: string;
  notas: string;
};

const FORMULARIO_INICIAL: Formulario = {
  nombre: "",
  telefono: "",
  provincia: "",
  municipio: "",
  direccion: "",
  notas: "",
};

export default function CheckoutPage() {
  const items = useCarrito();
  const [libros, setLibros] = useState<Record<number, LibroPublico>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formulario, setFormulario] =
    useState<Formulario>(FORMULARIO_INICIAL);
  const [formError, setFormError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [tarifasVersion, setTarifasVersion] = useState(0);

  useEffect(() => {
    const c = new AbortController();
    apiFetch<{ tarifas: { municipio: string; costo: number }[] }>("configuracion/mensajeria", { signal: c.signal } as any)
      .then((d) => { setTarifasMensajeria(d.tarifas || []); setTarifasVersion((v) => v + 1); })
      .catch(() => undefined);
    return () => c.abort();
  }, []);

  useEffect(() => {
    const ids = Array.from(new Set(items.map((item) => item.libroId)));
    const controller = new AbortController();
    let cancelado = false;

    async function cargarLibros() {
      if (ids.length === 0) {
        setLibros({});
        setCargando(false);
        return;
      }

      setCargando(true);
      setError(null);

      try {
        const resultados = await Promise.all(
          ids.map((id) =>
            fetchCatalogoLibro(id, controller.signal).catch(() => null),
          ),
        );

        if (cancelado) {
          return;
        }

        const mapa: Record<number, LibroPublico> = {};
        resultados.forEach((libro) => {
          if (libro) {
            mapa[libro.id] = libro;
          }
        });
        setLibros(mapa);
      } catch (requestError: unknown) {
        if (cancelado || controller.signal.aborted) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar los libros del carrito.",
        );
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    cargarLibros();

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [items]);

  const total = useMemo(
    () =>
      items.reduce((acumulado, item) => {
        const libro = libros[item.libroId];
        return libro
          ? acumulado + precioItemCup(libro, item) * item.cantidad
          : acumulado;
      }, 0),
    [items, libros],
  );

  const costoMensajeria = useMemo(
    () => costoMensajeriaDe(formulario.municipio, formulario.provincia),
    [formulario.municipio, formulario.provincia, tarifasVersion],
  );

  const totalAPagar = total + costoMensajeria;

  const faltanLibros = useMemo(
    () => items.some((item) => !libros[item.libroId]),
    [items, libros],
  );

  const hayNoDisponibles = useMemo(
    () =>
      items.some((item) => {
        const libro = libros[item.libroId];
        return Boolean(libro && !libro.disponible);
      }),
    [items, libros],
  );

  const municipios = useMemo(
    () => municipiosDe(formulario.provincia),
    [formulario.provincia],
  );

  function actualizarCampo<K extends keyof Formulario>(
    campo: K,
    valor: Formulario[K],
  ) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  function handleProvinciaChange(valor: string) {
    setFormulario((actual) => ({
      ...actual,
      provincia: valor,
      municipio: "",
    }));
  }

  function construirMensaje(): string {
    const lineas = items.map((item, index) => {
      const libro = libros[item.libroId];
      const acabados = [
        item.esquineros ? "esquineros" : null,
        item.cantosPintados ? "cantos pintados, esquineros" : null,
      ]
        .filter((valor): valor is string => valor !== null)
        .join(", ");
      const subtotal = libro ? precioItemCup(libro, item) * item.cantidad : 0;
      const subtotalUsd = libro ? precioItemUsd(libro, item) * item.cantidad : 0;

      return `${index + 1}. ${libro?.titulo ?? `Libro #${item.libroId}`} x${
        item.cantidad
      }${acabados ? ` (${acabados})` : ""} - ${money(subtotal, "CUP")}`;
    });

    const anticipo = Math.round(total / 2);
    const saldoLibros = total - anticipo;
    return [
      "Hola Vargas Editorial, quiero confirmar este pedido:",
      "",
      ...lineas,
      "",
      `Subtotal de libros: ${money(total, "CUP")}`,
      `Anticipo (50% libros): ${money(anticipo, "CUP")}`,
      `Saldo en entrega (50% libros): ${money(saldoLibros, "CUP")}`,
      `Mensajería: ${money(costoMensajeria, "CUP")}`,
      `Total a pagar: ${money(totalAPagar, "CUP")}`,
      "",
      `Nombre: ${formulario.nombre.trim()}`,
      `Teléfono: ${formulario.telefono.trim()}`,
      `Provincia: ${formulario.provincia}`,
      `Municipio: ${formulario.municipio}`,
      `Dirección: ${formulario.direccion.trim()}`,
      formulario.notas.trim()
        ? `Notas: ${formulario.notas.trim()}`
        : null,
    ]
      .filter((linea): linea is string => linea !== null)
      .join("\n");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (items.length === 0) {
      setFormError("Tu carrito está vacío.");
      return;
    }

    if (cargando) {
      setFormError("Espera a que terminemos de cargar los libros.");
      return;
    }

    if (faltanLibros) {
      setFormError(
        "No pudimos cargar todos los libros del carrito. Vuelve a intentarlo.",
      );
      return;
    }

    if (hayNoDisponibles) {
      setFormError(
        "Algunos libros están agotados. Vuelve al carrito y quítalos para continuar.",
      );
      return;
    }

    if (
      !formulario.nombre.trim() ||
      !formulario.telefono.trim() ||
      !formulario.provincia ||
      !formulario.municipio ||
      !formulario.direccion.trim()
    ) {
      setFormError("Completa todos los campos obligatorios.");
      return;
    }

    setFormError(null);
    setEnviado(true);

    const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
      construirMensaje(),
    )}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand/80"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al catálogo
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Pedido sin pago en línea
        </span>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-ink">
          Confirmar pedido
        </h1>
        <p className="mt-1 text-sm text-muted">
          Revisa tu carrito, completa tus datos y envía el pedido por
          WhatsApp. Te responderemos para coordinar el pago y la entrega.
        </p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Condiciones de pago</p>
          <p className="mt-1">El ANTICIPO puede ser depositado en efectivo o transferencia, pero el saldo restante debe ser pagado en efectivo junto con la mensajeria en caso de requerirla</p>
        </div>
      </header>

      {cargando ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white py-16 text-sm font-medium text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Cargando tu pedido...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-800">
          <p className="font-semibold">No se pudo cargar el pedido.</p>
          <p className="mt-1">{error}</p>
          <Link
            href="/catalogo"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al catálogo
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-line bg-white px-4 py-16 text-center text-sm text-muted">
          <ShoppingCart
            className="mx-auto mb-3 h-10 w-10 text-slate-300"
            aria-hidden="true"
          />
          <p className="font-semibold text-ink">Tu carrito está vacío.</p>
          <p className="mt-1">
            Agrega libros desde el catálogo para confirmar un pedido.
          </p>
          <Link
            href="/catalogo"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
          >
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
            <h2 className="text-xl font-extrabold text-ink">Tu pedido</h2>
            <p className="mt-1 text-sm text-muted">
              {items.length} {items.length === 1 ? "artículo" : "artículos"} en
              el carrito.
            </p>

            <div className="mt-5 space-y-4">
              {items.map((item) => {
                const libro = libros[item.libroId];
                const precioUnitarioCup = libro ? Math.round(precioItemCup(libro, item) / 50) * 50 : 0;
                const precioUnitarioUsd = libro ? precioItemUsd(libro, item) : 0;

                return (
                  <div
                    key={`${item.libroId}-${item.esquineros}-${item.cantosPintados}`}
                    className="rounded-lg border border-line p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-bold text-ink">
                            {libro ? libro.titulo : `Libro #${item.libroId}`}
                          </p>
                          {libro && !libro.disponible ? (
                            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              Agotado
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-sm text-muted">
                          {libro
                            ? libro.autor || "Autor desconocido"
                            : "No disponible"}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-brand">
                        {money(precioUnitarioUsd * item.cantidad, "USD")}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {item.cantidad} x {money(precioUnitarioUsd, "USD")} ({money(Math.round(precioUnitarioCup / 50) * 50, "CUP")})
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        Total: {money(precioUnitarioUsd * item.cantidad, "USD")} ({money(Math.round(precioUnitarioCup * item.cantidad / 50) * 50, "CUP")})
                      </span>
                      {item.esquineros ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                          Esquineros
                        </span>
                      ) : null}
                      {item.cantosPintados ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                          Cantos pintados
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-2 border-t border-line pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal de libros</span>
                <span className="font-semibold text-ink">
                  {money(total, "CUP")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Costo de mensajería</span>
                <span className="font-semibold text-ink">
                  {formulario.municipio
                    ? money(costoMensajeria, "CUP")
                    : "Selecciona un municipio"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3">
                <span className="text-sm font-semibold text-ink">
                  Total a pagar
                </span>
                <span className="text-2xl font-extrabold text-brand">
                  {money(totalAPagar, "CUP")}
                </span>
              </div>
              <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Anticipo (50% del pedido, sin mensajería)</span>
                  <span className="font-semibold text-ink">{money(Math.round(total / 2), "CUP")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Saldo en entrega (50% del pedido, sin mensajería)</span>
                  <span className="font-semibold text-ink">{money(total - Math.round(total / 2), "CUP")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Mensajería</span>
                  <span className="font-semibold text-ink">{formulario.municipio ? money(costoMensajeria, "CUP") : "Selecciona un municipio"}</span>
                </div>
              </div>
            </div>

            {faltanLibros && !cargando ? (
              <p className="mt-3 text-sm text-red-700">
                Algunos libros del carrito no se pudieron cargar. Vuelve al
                carrito y quita los libros no disponibles.
              </p>
            ) : null}

            {hayNoDisponibles && !cargando ? (
              <p className="mt-3 text-sm text-amber-700">
                Algunos libros están agotados. Vuelve al carrito y quítalos
                para continuar.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
            <h2 className="text-xl font-extrabold text-ink">
              Datos de entrega
            </h2>
            <p className="mt-1 text-sm text-muted">
              Los campos marcados con * son obligatorios.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  htmlFor="nombre"
                  className="mb-1 block text-sm font-semibold text-ink"
                >
                  Nombre completo *
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={formulario.nombre}
                  onChange={(event) =>
                    actualizarCampo("nombre", event.target.value)
                  }
                  autoComplete="name"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="telefono"
                  className="mb-1 block text-sm font-semibold text-ink"
                >
                  Teléfono *
                </label>
                <input
                  id="telefono"
                  type="tel"
                  value={formulario.telefono}
                  onChange={(event) =>
                    actualizarCampo("telefono", event.target.value)
                  }
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="Ej: 55512345"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="provincia"
                    className="mb-1 block text-sm font-semibold text-ink"
                  >
                    Provincia *
                  </label>
                  <select
                    id="provincia"
                    value={formulario.provincia}
                    onChange={(event) =>
                      handleProvinciaChange(event.target.value)
                    }
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    required
                  >
                    <option value="">Selecciona una provincia</option>
                    {PROVINCIAS.map((provincia) => (
                      <option key={provincia} value={provincia}>
                        {provincia}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="municipio"
                    className="mb-1 block text-sm font-semibold text-ink"
                  >
                    Municipio *
                  </label>
                  <select
                    id="municipio"
                    value={formulario.municipio}
                    onChange={(event) =>
                      actualizarCampo("municipio", event.target.value)
                    }
                    disabled={municipios.length === 0}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    required
                  >
                    <option value="">
                      {municipios.length === 0
                        ? "Selecciona una provincia primero"
                        : "Selecciona un municipio"}
                    </option>
                    {municipios.map((municipio) => (
                      <option key={municipio} value={municipio}>
                        {municipio}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="direccion"
                  className="mb-1 block text-sm font-semibold text-ink"
                >
                  Dirección *
                </label>
                <textarea
                  id="direccion"
                  value={formulario.direccion}
                  onChange={(event) =>
                    actualizarCampo("direccion", event.target.value)
                  }
                  rows={2}
                  autoComplete="street-address"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="notas"
                  className="mb-1 block text-sm font-semibold text-ink"
                >
                  Notas (opcional)
                </label>
                <textarea
                  id="notas"
                  value={formulario.notas}
                  onChange={(event) =>
                    actualizarCampo("notas", event.target.value)
                  }
                  rows={2}
                  placeholder="Referencias de entrega, horario, etc."
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {formError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {formError}
                </p>
              ) : null}

              {enviado ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Se abrió WhatsApp con el resumen de tu pedido. Envía el
                  mensaje para confirmarlo.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={cargando || faltanLibros || hayNoDisponibles}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Confirmar pedido por WhatsApp
              </button>

              <p className="text-center text-xs text-muted">
                El anticipo puede pagarse en efectivo o transferencia; el saldo restante se entrega en efectivo a la mensajería al recibir el pedido.
              </p>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

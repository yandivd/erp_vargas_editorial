"use client";

import { useEffect, useState } from "react";
import {
  Heart,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import ShopBookCard from "./ShopBookCard";
import { fetchRecomendaciones, type LibroPublico } from "@/lib/catalogos";
import { calcularPrecioConAcabados } from "@/lib/costos";
import { money } from "@/lib/format";
import { libroImagenSrc } from "@/lib/libros";

type LibroDetalleModalProps = {
  libro: LibroPublico;
  favorito: boolean;
  favoritos: number[];
  onClose: () => void;
  onToggleFavorito: (libro: LibroPublico) => void;
  onAddToCart: (
    libro: LibroPublico,
    opciones: {
      esquineros: boolean;
      cantosPintados: boolean;
      cantidad: number;
    },
  ) => void;
  onSelectLibro: (libro: LibroPublico) => void;
};

export default function LibroDetalleModal({
  libro,
  favorito,
  favoritos,
  onClose,
  onToggleFavorito,
  onAddToCart,
  onSelectLibro,
}: LibroDetalleModalProps) {
  const [esquineros, setEsquineros] = useState(false);
  const [cantosPintados, setCantosPintados] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [recomendaciones, setRecomendaciones] = useState<LibroPublico[]>([]);
  const [cargandoRecomendaciones, setCargandoRecomendaciones] =
    useState(true);
  const [errorRecomendaciones, setErrorRecomendaciones] = useState<
    string | null
  >(null);
  const [agregado, setAgregado] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelado = false;

    async function cargarRecomendaciones() {
      setCargandoRecomendaciones(true);
      setErrorRecomendaciones(null);
      setRecomendaciones([]);

      try {
        const data = await fetchRecomendaciones(
          libro.id,
          favoritos,
          controller.signal,
        );

        if (!cancelado) {
          setRecomendaciones(data);
        }
      } catch (error: unknown) {
        if (cancelado || controller.signal.aborted) {
          return;
        }

        setErrorRecomendaciones(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las recomendaciones.",
        );
      } finally {
        if (!cancelado) {
          setCargandoRecomendaciones(false);
        }
      }
    }

    cargarRecomendaciones();

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [libro.id, favoritos]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const precioBase = Number(libro.precio);
  const precioUnitario = calcularPrecioConAcabados(
    precioBase,
    cantosPintados,
    esquineros,
  );
  const total = precioUnitario * cantidad;
  const incrementoEsquineros =
    calcularPrecioConAcabados(precioBase, false, true) - precioBase;
  const incrementoCantos =
    calcularPrecioConAcabados(precioBase, true, false) - precioBase;

  function handleAddToCart() {
    if (!libro.disponible) {
      return;
    }

    onAddToCart(libro, { esquineros, cantosPintados, cantidad });
    setAgregado(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${libro.titulo}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              Detalle del libro
            </p>
            <h2 className="truncate text-lg font-extrabold text-ink">
              {libro.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-ink"
            aria-label="Cerrar detalle"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <div className="aspect-[21/9] overflow-hidden rounded-xl bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={libroImagenSrc(libro.imagen)}
                  alt={`Portada de ${libro.titulo}`}
                  className="h-full w-full object-cover"
                />
              </div>
              {libro.descripcion ? (
                <p className="mt-4 text-sm text-muted">{libro.descripcion}</p>
              ) : null}
            </div>

            <div>
              <p className="text-sm text-muted">
                {libro.autor || "Autor desconocido"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-2xl font-extrabold text-brand">
                  {money(precioBase, "CUP")}
                </span>
                {!libro.disponible ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Agotado
                  </span>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                <label
                  className={`flex items-start gap-3 rounded-lg border border-line p-3 transition ${
                    cantosPintados
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={esquineros}
                    disabled={cantosPintados}
                    onChange={(event) => setEsquineros(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      Esquineros
                    </span>
                    <span className="text-xs text-muted">
                      {cantosPintados
                        ? "Incluido en cantos pintados"
                        : `+${money(incrementoEsquineros, "CUP")}`}
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={cantosPintados}
                    onChange={(event) => {
                      setCantosPintados(event.target.checked);
                      if (event.target.checked) {
                        setEsquineros(false);
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      Cantos pintados
                    </span>
                    <span className="text-xs text-muted">
                      +{money(incrementoCantos, "CUP")}
                    </span>
                  </span>
                </label>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm font-semibold text-ink">
                  Cantidad
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCantidad((actual) => Math.max(1, actual - 1))
                    }
                    className="rounded-md border border-line bg-white p-1.5 text-ink transition hover:bg-slate-100"
                    aria-label="Disminuir cantidad"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-ink">
                    {cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCantidad((actual) => actual + 1)}
                    className="rounded-md border border-line bg-white p-1.5 text-ink transition hover:bg-slate-100"
                    aria-label="Aumentar cantidad"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-brand/20 bg-brand/5 p-4">
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Precio por unidad</span>
                  <span className="font-semibold text-ink">
                    {money(precioUnitario, "CUP")}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm text-muted">Total</span>
                  <span className="text-xl font-extrabold text-brand">
                    {money(total, "CUP")}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!libro.disponible}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  {libro.disponible ? "Agregar al carrito" : "Agotado"}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorito(libro)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-50"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      favorito ? "fill-red-500 text-red-500" : ""
                    }`}
                    aria-hidden="true"
                  />
                  {favorito ? "En favoritos" : "Favorito"}
                </button>
              </div>

              {agregado ? (
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Agregado al carrito.
                </p>
              ) : null}
            </div>
          </div>

          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
              <h3 className="text-base font-extrabold text-ink">
                También te puede interesar
              </h3>
            </div>

            {cargandoRecomendaciones ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Buscando recomendaciones...
              </div>
            ) : errorRecomendaciones ? (
              <p className="text-sm text-red-700">{errorRecomendaciones}</p>
            ) : recomendaciones.length === 0 ? (
              <p className="text-sm text-muted">
                Aún no hay recomendaciones para este libro.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recomendaciones.map((item) => (
                  <ShopBookCard
                    key={item.id}
                    libro={item}
                    favorito={favoritos.includes(item.id)}
                    onToggleFavorito={onToggleFavorito}
                    onClick={onSelectLibro}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

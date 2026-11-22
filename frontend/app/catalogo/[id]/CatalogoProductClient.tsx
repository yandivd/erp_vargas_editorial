"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Heart, Info, Loader2, Minus, Plus, ShoppingCart, Sparkles, X } from "lucide-react";
import BookImage from "@/components/libros/BookImage";
import ShopBookCard from "@/components/catalogos/ShopBookCard";
import { CatalogoDecoracion, CatalogoSeasonBanner } from "@/components/catalogos/CatalogoDecoracion";
import { fetchRecomendaciones, type LibroPublico } from "@/lib/catalogos";
import { fetchDecoracionTema, normalizarTemaDecoracion, type TemaDecoracion } from "@/lib/decoracion";
import { calcularPrecioConAcabados } from "@/lib/costos";
import { money } from "@/lib/format";
import { escribirCarrito, escribirFavoritos, useCarrito, useFavoritos, type CarritoItem } from "@/lib/tienda";

type Props = { libro: LibroPublico };

function mismoItem(a: CarritoItem, b: CarritoItem): boolean {
  return a.libroId === b.libroId && a.esquineros === b.esquineros && a.cantosPintados === b.cantosPintados;
}

export default function CatalogoProductClient({ libro }: Props) {
  const favoritos = useFavoritos();
  const carrito = useCarrito();
  const [esquineros, setEsquineros] = useState(false);
  const [cantosPintados, setCantosPintados] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [recomendaciones, setRecomendaciones] = useState<LibroPublico[]>([]);
  const [cargandoRecomendaciones, setCargandoRecomendaciones] = useState(true);
  const [errorRecomendaciones, setErrorRecomendaciones] = useState<string | null>(null);
  const [agregado, setAgregado] = useState(false);
  const [modalAcabados, setModalAcabados] = useState(false);
  const [tema, setTema] = useState<TemaDecoracion>("navidad");

  useEffect(() => {
    const c = new AbortController();
    fetchDecoracionTema(c.signal).then((t) => setTema(normalizarTemaDecoracion(t)));
    return () => c.abort();
  }, []);

  const esquinerosEfectivos = esquineros || cantosPintados;
  const favorito = favoritos.includes(libro.id);

  useEffect(() => {
    const controller = new AbortController();
    let cancelado = false;
    async function cargar() {
      setCargandoRecomendaciones(true);
      setErrorRecomendaciones(null);
      try {
        const data = await fetchRecomendaciones(libro.id, favoritos, controller.signal);
        if (!cancelado) setRecomendaciones(data);
      } catch (error: unknown) {
        if (cancelado || controller.signal.aborted) return;
        setErrorRecomendaciones(error instanceof Error ? error.message : "No se pudieron cargar las recomendaciones.");
      } finally {
        if (!cancelado) setCargandoRecomendaciones(false);
      }
    }
    cargar();
    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [libro.id, favoritos]);

  const precioBase = Number(libro.precio_cup_referencia ?? libro.precio_cup ?? libro.precio);
  const precioUnitario = calcularPrecioConAcabados(precioBase, cantosPintados, esquinerosEfectivos);
  const total = precioUnitario * cantidad;
  const incrementoEsquineros = calcularPrecioConAcabados(precioBase, false, true) - precioBase;
  const incrementoCantos = calcularPrecioConAcabados(precioBase, true, false) - precioBase;

  const carritoCount = useMemo(() => carrito.reduce((t, i) => t + i.cantidad, 0), [carrito]);

  function handleToggleFavorito(target: LibroPublico) {
    escribirFavoritos(
      favoritos.includes(target.id) ? favoritos.filter((id) => id !== target.id) : [...favoritos, target.id],
    );
  }

  function handleAddToCart() {
    if (!libro.disponible) return;
    const nuevoItem: CarritoItem = {
      libroId: libro.id,
      cantidad,
      esquineros: esquinerosEfectivos,
      cantosPintados,
    };
    const existente = carrito.find((item) => mismoItem(item, nuevoItem));
    escribirCarrito(
      existente
        ? carrito.map((item) => (mismoItem(item, nuevoItem) ? { ...item, cantidad: item.cantidad + nuevoItem.cantidad } : item))
        : [...carrito, nuevoItem],
    );
    setAgregado(true);
  }

  const bgImage = tema === "halloween"
    ? "radial-gradient(circle at top, rgba(251,146,60,0.14), transparent 35%), linear-gradient(to bottom, #0b0614 0%, #1a1025 55%, #09040f 100%)"
    : tema === "ninguno"
      ? "linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)"
      : "url('/img/navidad/stars.svg'), linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)";

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-slate-950"
      style={{ backgroundImage: bgImage, backgroundRepeat: tema === "navidad" ? "repeat, no-repeat" : "no-repeat", backgroundSize: "cover" }}
    >
      <CatalogoDecoracion tema={tema} />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-24 md:px-8 md:pt-28">
        <div className="mb-6 flex justify-center"><CatalogoSeasonBanner tema={tema} /></div>
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a la tienda
          </Link>
          <Link
            href="/catalogo/checkout"
            className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Carrito {carritoCount > 0 ? `(${carritoCount})` : ""}
          </Link>
        </div>

        <div className="rounded-2xl bg-white shadow-2xl">
          <div className="p-5 md:p-8">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div>
                <BookImage
                  libro={libro}
                  llevaEsquineros={esquinerosEfectivos}
                  llevaCantosTintados={cantosPintados}
                  className="aspect-[3/4] w-full max-w-md rounded-xl"
                />
                <p className="mt-3 max-w-md text-xs text-muted">
                  Nota sobre el acabado: Las imágenes son ilustrativas. Al ser un producto de encuadernación artesanal, los detalles finales pueden variar ligeramente respecto a la referencia visual. Garantizamos la calidad de los materiales y la técnica de nuestro trabajo.
                </p>
                {libro.descripcion ? <p className="mt-4 text-sm text-muted">{libro.descripcion}</p> : null}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">Detalle del libro</p>
                <h1 className="mt-1 text-2xl font-extrabold text-ink md:text-3xl">{libro.titulo}</h1>
                <p className="mt-1 text-sm text-muted">{libro.autor || "Autor desconocido"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-2xl font-extrabold text-brand">{money(libro.precio_usd ?? 0, "USD")}</span>
                  <span className="text-sm font-semibold text-muted">~ {money(libro.precio_cup_referencia ?? precioBase, "CUP")} (al cambio de hoy)</span>
                  {!libro.disponible ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Agotado
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => setModalAcabados(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-2 transition hover:text-brand-dark"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                    ¿Qué son los cantos tintados y los esquineros?
                  </button>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={cantosPintados}
                      onChange={(event) => setCantosPintados(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">Cantos pintados</span>
                      <span className="text-xs text-muted">Incluye esquineros · +{money(incrementoCantos, "CUP")}</span>
                    </span>
                  </label>

                  <label
                    className={`flex items-start gap-3 rounded-lg border border-line p-3 transition ${
                      cantosPintados ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={esquinerosEfectivos}
                      disabled={cantosPintados}
                      onChange={(event) => setEsquineros(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">Esquineros</span>
                      <span className="text-xs text-muted">
                        {cantosPintados ? "Incluidos con cantos pintados" : `+${money(incrementoEsquineros, "CUP")}`}
                      </span>
                    </span>
                  </label>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <span className="text-sm font-semibold text-ink">Cantidad</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCantidad((actual) => Math.max(1, actual - 1))}
                      className="rounded-md border border-line bg-white p-1.5 text-ink transition hover:bg-slate-100"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-ink">{cantidad}</span>
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
                    <span className="font-semibold text-ink">{money(precioUnitario, "CUP")}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm text-muted">Total</span>
                    <span className="text-xl font-extrabold text-brand">{money(total, "CUP")}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!libro.disponible}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                    {libro.disponible ? "Agregar al carrito" : "Agotado"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorito(libro)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-50"
                  >
                    <Heart className={`h-4 w-4 ${favorito ? "fill-red-500 text-red-500" : ""}`} aria-hidden="true" />
                    {favorito ? "En favoritos" : "Favorito"}
                  </button>
                </div>

                {agregado ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Agregado al carrito.
                    </p>
                    <Link
                      href="/catalogo/checkout"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                      Ir al carrito
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>

            <section className="mt-10">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
                <h2 className="text-base font-extrabold text-ink">También te puede interesar</h2>
              </div>

              {cargandoRecomendaciones ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Buscando recomendaciones...
                </div>
              ) : errorRecomendaciones ? (
                <p className="text-sm text-red-700">{errorRecomendaciones}</p>
              ) : recomendaciones.length === 0 ? (
                <p className="text-sm text-muted">Aún no hay recomendaciones para este libro.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
                  {recomendaciones.map((item) => (
                    <ShopBookCard
                      key={item.id}
                      libro={item}
                      favorito={favoritos.includes(item.id)}
                      onToggleFavorito={handleToggleFavorito}
                      href={`/catalogo/${item.id}`}
                      compact
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {modalAcabados ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalAcabados(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-acabados-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="modal-acabados-title" className="text-lg font-extrabold text-ink">
                Cantos tintados y esquineros
              </h2>
              <button
                type="button"
                onClick={() => setModalAcabados(false)}
                className="rounded-lg p-2 text-muted transition hover:bg-slate-100 hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-slate-50">
              <img
                src="/img/catalogo/cantos-esquineros.jpg"
                alt="Ejemplo de cantos tintados y esquineros en un libro"
                className="mx-auto h-auto w-full max-w-[90px] object-cover sm:max-w-[120px]"
                loading="lazy"
              />
            </div>

            <div className="mt-4 space-y-4 text-sm text-muted">
              <div>
                <h3 className="font-bold text-ink">Esquineros</h3>
                <p className="mt-1">
                  Los esquineros son protectores metálicos que van instalados en las esquinas del libro y sirven para proteger las portadas del desgaste y los golpes y para darle un acabado más elegante y duradero.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-ink">Cantos tintados</h3>
                <p className="mt-1">
                  Los cantos tintados son el borde de las hojas pintados, lo que evita que el papel se ensucie y le da un aspecto de lujo tipo edición de coleccionista.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setModalAcabados(false)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

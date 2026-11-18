"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Gift,
  Heart,
  Library,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import BookCatalog from "@/components/catalogos/BookCatalog";
import Garland from "@/components/catalogos/Garland";
import LibroDetalleModal from "@/components/catalogos/LibroDetalleModal";
import SantaIcon from "@/components/catalogos/SantaIcon";
import SeasonBanner from "@/components/catalogos/SeasonBanner";
import ShopBookCard from "@/components/catalogos/ShopBookCard";
import Snowfall from "@/components/catalogos/Snowfall";
import {
  fetchCatalogoLibro,
  fetchCatalogoPage,
  type LibroPublico,
} from "@/lib/catalogos";
import { money } from "@/lib/format";
import {
  escribirCarrito,
  escribirFavoritos,
  precioItem,
  useCarrito,
  useFavoritos,
  type CarritoItem,
} from "@/lib/tienda";

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 350;

type TabId = "catalogo" | "favoritos" | "carrito";

function mismoItem(a: CarritoItem, b: CarritoItem): boolean {
  return (
    a.libroId === b.libroId &&
    a.esquineros === b.esquineros &&
    a.cantosPintados === b.cantosPintados
  );
}

export default function CatalogoPage() {
  const reduceMotion = useReducedMotion();
  const [books, setBooks] = useState<LibroPublico[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [tab, setTab] = useState<TabId>("catalogo");
  const favoritos = useFavoritos();
  const carrito = useCarrito();
  const [libroSeleccionado, setLibroSeleccionado] =
    useState<LibroPublico | null>(null);

  const [favoritosLibros, setFavoritosLibros] = useState<LibroPublico[]>([]);
  const [cargandoFavoritos, setCargandoFavoritos] = useState(true);
  const [errorFavoritos, setErrorFavoritos] = useState<string | null>(null);

  const [carritoLibros, setCarritoLibros] = useState<
    Record<number, LibroPublico>
  >({});
  const [cargandoCarrito, setCargandoCarrito] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const requestedPage = page;

    fetchCatalogoPage({
      page: requestedPage,
      perPage: PER_PAGE,
      query: appliedQuery,
      signal: controller.signal,
    })
      .then(({ books: nextBooks, pagination }) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setBooks((currentBooks) =>
          requestedPage === 1
            ? nextBooks
            : [...currentBooks, ...nextBooks],
        );
        setHasNext(Boolean(pagination?.has_next));
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (
          controller.signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar el catálogo.",
        );
        setHasNext(false);
      })
      .finally(() => {
        if (
          controller.signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        loadingMoreRef.current = false;
        setLoadingInitial(false);
        setLoadingMore(false);
      });

    return () => controller.abort();
  }, [appliedQuery, page, reloadKey]);

  useEffect(() => {
    if (tab !== "favoritos") {
      return;
    }

    const controller = new AbortController();
    let cancelado = false;

    async function cargarFavoritos() {
      if (favoritos.length === 0) {
        setFavoritosLibros([]);
        setCargandoFavoritos(false);
        setErrorFavoritos(null);
        return;
      }

      setCargandoFavoritos(true);
      setErrorFavoritos(null);

      try {
        const libros = await Promise.all(
          favoritos.map((id) =>
            fetchCatalogoLibro(id, controller.signal).catch(() => null),
          ),
        );

        if (cancelado) {
          return;
        }

        setFavoritosLibros(
          libros.filter((libro): libro is LibroPublico => libro !== null),
        );
      } catch (requestError: unknown) {
        if (cancelado || controller.signal.aborted) {
          return;
        }

        setErrorFavoritos(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar los favoritos.",
        );
      } finally {
        if (!cancelado) {
          setCargandoFavoritos(false);
        }
      }
    }

    cargarFavoritos();

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [tab, favoritos]);

  useEffect(() => {
    if (tab !== "carrito") {
      return;
    }

    const missing = Array.from(
      new Set(carrito.map((item) => item.libroId)),
    ).filter((id) => !carritoLibros[id]);

    if (missing.length === 0) {
      return;
    }

    const controller = new AbortController();
    let cancelado = false;

    async function cargarCarrito() {
      setCargandoCarrito(true);

      try {
        const libros = await Promise.all(
          missing.map((id) =>
            fetchCatalogoLibro(id, controller.signal).catch(() => null),
          ),
        );

        if (cancelado) {
          return;
        }

        setCarritoLibros((actual) => {
          const next = { ...actual };
          let cambio = false;

          libros.forEach((libro) => {
            if (libro && !next[libro.id]) {
              next[libro.id] = libro;
              cambio = true;
            }
          });

          return cambio ? next : actual;
        });
      } finally {
        if (!cancelado) {
          setCargandoCarrito(false);
        }
      }
    }

    cargarCarrito();

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [tab, carrito, carritoLibros]);

  const loadMore = useCallback(() => {
    if (loadingInitial || loadingMore || loadingMoreRef.current || !hasNext) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPage((currentPage) => currentPage + 1);
  }, [hasNext, loadingInitial, loadingMore]);

  useEffect(() => {
    if (tab !== "catalogo") {
      return;
    }

    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore, tab]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      requestIdRef.current += 1;
      loadingMoreRef.current = false;
      setBooks([]);
      setPage(1);
      setHasNext(true);
      setError(null);
      setLoadingInitial(true);
      setLoadingMore(false);
      setAppliedQuery(value.trim());
      setReloadKey((currentKey) => currentKey + 1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const retry = useCallback(() => {
    requestIdRef.current += 1;
    setError(null);
    setHasNext(true);

    if (books.length === 0) {
      setLoadingInitial(true);
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    setReloadKey((currentKey) => currentKey + 1);
  }, [books.length]);

  const favoritosSet = useMemo(() => new Set(favoritos), [favoritos]);

  const carritoCount = useMemo(
    () => carrito.reduce((total, item) => total + item.cantidad, 0),
    [carrito],
  );

  const totalCarrito = useMemo(
    () =>
      carrito.reduce((total, item) => {
        const libro = carritoLibros[item.libroId];
        return libro
          ? total + precioItem(libro, item) * item.cantidad
          : total;
      }, 0),
    [carrito, carritoLibros],
  );

  function handleToggleFavorito(libro: LibroPublico) {
    escribirFavoritos(
      favoritos.includes(libro.id)
        ? favoritos.filter((id) => id !== libro.id)
        : [...favoritos, libro.id],
    );
  }

  function handleAddToCart(
    libro: LibroPublico,
    opciones: {
      esquineros: boolean;
      cantosPintados: boolean;
      cantidad: number;
    },
  ) {
    const nuevoItem: CarritoItem = {
      libroId: libro.id,
      cantidad: opciones.cantidad,
      esquineros: opciones.esquineros,
      cantosPintados: opciones.cantosPintados,
    };

    const existente = carrito.find((item) => mismoItem(item, nuevoItem));

    escribirCarrito(
      existente
        ? carrito.map((item) =>
            mismoItem(item, nuevoItem)
              ? { ...item, cantidad: item.cantidad + nuevoItem.cantidad }
              : item,
          )
        : [...carrito, nuevoItem],
    );

    setCarritoLibros((actual) => ({ ...actual, [libro.id]: libro }));
  }

  function actualizarCantidad(item: CarritoItem, delta: number) {
    escribirCarrito(
      carrito
        .map((current) =>
          mismoItem(current, item)
            ? { ...current, cantidad: current.cantidad + delta }
            : current,
        )
        .filter((current) => current.cantidad > 0),
    );
  }

  function quitarDelCarrito(item: CarritoItem) {
    escribirCarrito(carrito.filter((current) => !mismoItem(current, item)));
  }

  const tabs: { id: TabId; label: string; icon: typeof Library; badge: number }[] = [
    { id: "catalogo", label: "Catálogo", icon: Library, badge: 0 },
    { id: "favoritos", label: "Favoritos", icon: Heart, badge: favoritos.length },
  ];

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-slate-950"
      style={{
        backgroundImage:
          "url('/img/navidad/stars.svg'), linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)",
        backgroundRepeat: "repeat, no-repeat",
        backgroundSize: "auto, cover",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-24 opacity-70 sm:block md:w-40 lg:w-56"
        style={{
          backgroundImage: "url('/img/navidad/pine-left.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 right-0 z-0 hidden w-24 opacity-70 sm:block md:w-40 lg:w-56"
        style={{
          backgroundImage: "url('/img/navidad/pine-right.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-24 w-full md:h-32"
        style={{
          backgroundImage: "url('/img/navidad/snow-bottom.svg')",
          backgroundSize: "100% 100%",
          backgroundPosition: "bottom",
          backgroundRepeat: "no-repeat",
        }}
      />
      <Snowfall />
      <Garland />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-28 md:px-8 md:pt-32">
      <header className="mb-8 flex flex-col items-center text-center">
        <div className="rounded-2xl border border-amber-300/40 bg-white/95 p-3 shadow-[0_0_50px_rgba(251,191,36,0.18)]">
          <Image
            src="/img/logo.jpg"
            alt="Vargas Editorial"
            width={260}
            height={120}
            priority
            className="h-auto max-h-16 w-auto object-contain"
          />
        </div>
        <SeasonBanner />
        <h1 className="mt-5 bg-gradient-to-r from-amber-200 via-yellow-50 to-amber-200 bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-[0_2px_10px_rgba(251,191,36,0.25)] md:text-5xl">
          Vargas Editorial
        </h1>
        <p className="mt-2 text-sm text-slate-300 md:text-base">
          Catálogo público de encuadernación y edición.
        </p>
      </header>

      <nav
        className="mb-6 flex flex-wrap items-center justify-center gap-2"
        aria-label="Secciones de la tienda"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          const activo = tab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={activo}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activo
                  ? "border-amber-300 bg-red-600 text-white shadow-lg shadow-red-900/40"
                  : "border-white/15 bg-white/10 text-slate-100 backdrop-blur hover:bg-white/20"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
              {item.badge > 0 ? (
                <span
                  className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                    activo
                      ? "bg-amber-300 text-red-950"
                      : "bg-white/15 text-slate-100"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}

        <motion.button
          type="button"
          onClick={() => setTab("carrito")}
          aria-pressed={tab === "carrito"}
          whileHover={reduceMotion ? undefined : { scale: 1.05, rotate: 2 }}
          whileTap={reduceMotion ? undefined : { scale: 0.92, rotate: -8 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className={`relative inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            tab === "carrito"
              ? "border-amber-300 bg-red-600 text-white shadow-lg shadow-red-900/40"
              : "border-white/15 bg-white/10 text-slate-100 backdrop-blur hover:bg-white/20"
          }`}
        >
          <span className="relative inline-flex">
            <SantaIcon className="h-5 w-5" />
            {carritoCount > 0 ? (
              <motion.span
                key={carritoCount}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[10px] font-extrabold text-red-950 shadow"
              >
                {carritoCount}
              </motion.span>
            ) : null}
          </span>
          Carrito
        </motion.button>
      </nav>

      {tab === "catalogo" ? (
        <BookCatalog
          books={books}
          query={query}
          onQueryChange={handleQueryChange}
          error={error}
          loadingInitial={loadingInitial}
          loadingMore={loadingMore}
          hasNext={hasNext}
          onRetry={retry}
          sentinelRef={sentinelRef}
          onBookClick={setLibroSeleccionado}
          favoritos={favoritosSet}
          onToggleFavorito={handleToggleFavorito}
        />
      ) : null}

      {tab === "favoritos" ? (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-amber-100">
              Tus favoritos
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Los libros que guardaste para comprar más tarde.
            </p>
          </div>

          {cargandoFavoritos ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm font-medium text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando favoritos...
            </div>
          ) : errorFavoritos ? (
            <p className="rounded-lg border border-red-400/30 bg-red-950/40 px-4 py-6 text-center text-sm text-red-200">
              {errorFavoritos}
            </p>
          ) : favoritosLibros.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              <Heart
                className="mx-auto mb-3 h-8 w-8 text-slate-600"
                aria-hidden="true"
              />
              <p className="font-semibold text-slate-200">
                Aún no tienes libros favoritos.
              </p>
              <p className="mt-1">
                Toca el corazón (o el regalo) en cualquier libro para guardarlo
                aquí.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {favoritosLibros.map((libro) => (
                <ShopBookCard
                  key={libro.id}
                  libro={libro}
                  favorito={favoritosSet.has(libro.id)}
                  onToggleFavorito={handleToggleFavorito}
                  onClick={setLibroSeleccionado}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "carrito" ? (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-amber-100">
              Tu carrito
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Revisa los libros y acabados antes de confirmar tu pedido.
            </p>
          </div>

          {carrito.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              <SantaIcon className="mx-auto mb-3 h-10 w-10" />
              <p className="font-semibold text-slate-200">
                Tu carrito está vacío.
              </p>
              <p className="mt-1">
                Explora el catálogo y agrega los libros que quieras comprar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {carrito.map((item) => {
                const libro = carritoLibros[item.libroId];
                const precioUnitario = libro ? precioItem(libro, item) : 0;

                return (
                  <div
                    key={`${item.libroId}-${item.esquineros}-${item.cantosPintados}`}
                    className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-bold text-slate-100">
                          {libro ? libro.titulo : `Libro #${item.libroId}`}
                        </p>
                        {libro && !libro.disponible ? (
                          <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                            Agotado
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-slate-400">
                        {libro
                          ? libro.autor || "Autor desconocido"
                          : "No disponible"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {item.esquineros ? (
                          <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-slate-300">
                            Esquineros
                          </span>
                        ) : null}
                        {item.cantosPintados ? (
                          <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-slate-300">
                            Cantos pintados
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        {money(precioUnitario, "CUP")} por unidad
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => actualizarCantidad(item, -1)}
                          className="rounded-md border border-white/10 bg-slate-800 p-1.5 text-slate-100 transition hover:bg-slate-700"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-slate-100">
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => actualizarCantidad(item, 1)}
                          className="rounded-md border border-white/10 bg-slate-800 p-1.5 text-slate-100 transition hover:bg-slate-700"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <span className="min-w-24 text-right text-base font-extrabold text-amber-300">
                        {money(precioUnitario * item.cantidad, "CUP")}
                      </span>

                      <button
                        type="button"
                        onClick={() => quitarDelCarrito(item)}
                        className="rounded-md p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Quitar del carrito"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total del carrito</p>
                  <p className="text-2xl font-extrabold text-amber-300">
                    {money(totalCarrito, "CUP")}
                  </p>
                  {cargandoCarrito ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Loader2
                        className="h-3 w-3 animate-spin"
                        aria-hidden="true"
                      />
                      Actualizando precios...
                    </p>
                  ) : null}
                </div>
                <Link
                  href="/catalogo/checkout"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/50 bg-gradient-to-r from-red-600 to-red-700 px-5 py-2.5 text-sm font-bold text-amber-50 shadow-lg shadow-red-900/40 transition hover:from-red-500 hover:to-red-600"
                >
                  <Gift className="h-4 w-4" aria-hidden="true" />
                  Ir a confirmar pedido
                </Link>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {libroSeleccionado ? (
        <LibroDetalleModal
          key={libroSeleccionado.id}
          libro={libroSeleccionado}
          favorito={favoritosSet.has(libroSeleccionado.id)}
          favoritos={favoritos}
          onClose={() => setLibroSeleccionado(null)}
          onToggleFavorito={handleToggleFavorito}
          onAddToCart={handleAddToCart}
          onSelectLibro={setLibroSeleccionado}
        />
      ) : null}
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Gift, Heart, Library, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import BookCatalog from "@/components/catalogos/BookCatalog";
import SantaIcon from "@/components/catalogos/SantaIcon";
import ShopBookCard from "@/components/catalogos/ShopBookCard";
import { CatalogoDecoracion, CatalogoSeasonBanner } from "@/components/catalogos/CatalogoDecoracion";
import { fetchCatalogoLibro, fetchCatalogoPage, fetchRecomendaciones, type LibroPublico } from "@/lib/catalogos";
import { fetchDecoracionTema, normalizarTemaDecoracion, type TemaDecoracion } from "@/lib/decoracion";
import { money } from "@/lib/format";
import { escribirCarrito, escribirFavoritos, precioItem, useCarrito, useFavoritos, type CarritoItem } from "@/lib/tienda";

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 350;

type TabId = "catalogo" | "favoritos" | "carrito";

function mismoItem(a: CarritoItem, b: CarritoItem): boolean {
  return a.libroId === b.libroId && a.esquineros === b.esquineros && a.cantosPintados === b.cantosPintados;
}

function getRandomSeed(): string {
  if (typeof window === "undefined") return "catalogo";
  const key = "vargas_catalogo_seed";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const seed = String(Math.floor(Math.random() * 1_000_000_000));
  window.sessionStorage.setItem(key, seed);
  return seed;
}

export default function CatalogoPage() {
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<TabId>("catalogo");
  const [tema, setTema] = useState<TemaDecoracion>("navidad");

  useEffect(() => {
    const c = new AbortController();
    fetchDecoracionTema(c.signal).then((t) => setTema(normalizarTemaDecoracion(t)));
    return () => c.abort();
  }, []);

  const favoritos = useFavoritos();
  const carrito = useCarrito();
  const favoritosSet = useMemo(() => new Set(favoritos), [favoritos]);

  // Recomendaciones personalizadas
  const [recomendados, setRecomendados] = useState<LibroPublico[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [recLabel, setRecLabel] = useState("Recomendaciones para ti");

  // Más vendidos
  const [masVendidos, setMasVendidos] = useState<LibroPublico[]>([]);
  const [loadingVendidos, setLoadingVendidos] = useState(true);

  // Todos los libros (aleatorio + búsqueda + infinite scroll)
  const [books, setBooks] = useState<LibroPublico[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [seed] = useState(getRandomSeed);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  // Favoritos/carrito data
  const [favoritosLibros, setFavoritosLibros] = useState<LibroPublico[]>([]);
  const [cargandoFavoritos, setCargandoFavoritos] = useState(true);
  const [errorFavoritos, setErrorFavoritos] = useState<string | null>(null);
  const [carritoLibros, setCarritoLibros] = useState<Record<number, LibroPublico>>({});
  const [cargandoCarrito, setCargandoCarrito] = useState(false);

  useEffect(() => () => { if (debounceRef.current !== null) window.clearTimeout(debounceRef.current); }, []);

  // Recomendaciones: usa favoritos si existen; si no, usa top vendidos como fallback
  useEffect(() => {
    const controller = new AbortController();
    let cancelado = false;
    const TARGET_MIN = 5;
    const TARGET_MAX = 10;

    const pushUnique = (dest: LibroPublico[], seen: Set<number>, items: LibroPublico[]) => {
      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        dest.push(item);
        if (dest.length >= TARGET_MAX) break;
      }
    };

    async function cargar() {
      setLoadingRecs(true);
      try {
        const seen = new Set<number>();
        const acumulado: LibroPublico[] = [];

        if (favoritos.length > 0) {
          const favId = favoritos[favoritos.length - 1];
          const [favLibro, recs] = await Promise.all([
            fetchCatalogoLibro(favId, controller.signal).catch(() => null),
            fetchRecomendaciones(favId, favoritos, controller.signal).catch(() => []),
          ]);
          if (cancelado) return;

          pushUnique(acumulado, seen, recs);
          setRecLabel(favLibro ? `Porque te gustó ${favLibro.titulo}` : "Recomendaciones para ti");

          // Si faltan, buscar "un nivel más arriba": recomendaciones de los libros ya recomendados.
          if (acumulado.length < TARGET_MIN) {
            const seedIds = acumulado.slice(0, 3).map((b) => b.id);
            const secondLevel = await Promise.all(
              seedIds.map((id) =>
                fetchRecomendaciones(id, [...favoritos, ...acumulado.map((b) => b.id)], controller.signal).catch(() => []),
              ),
            );
            if (cancelado) return;
            for (const group of secondLevel) {
              pushUnique(acumulado, seen, group);
              if (acumulado.length >= TARGET_MAX) break;
            }
          }
        } else {
          setRecLabel("Recomendaciones para ti");
        }

        // Rellenar con más vendidos si aún faltan (sin duplicados/favoritos ya vistos).
        if (acumulado.length < TARGET_MIN) {
          const fallback = await fetchCatalogoPage({
            page: 1,
            perPage: 12,
            ordering: "-ventas",
            signal: controller.signal,
          });
          if (cancelado) return;
          pushUnique(
            acumulado,
            seen,
            fallback.books.filter((b) => !favoritosSet.has(b.id)),
          );
        }

        if (!cancelado) setRecomendados(acumulado.slice(0, TARGET_MAX));
      } catch {
        if (!cancelado) setRecomendados([]);
      } finally {
        if (!cancelado) setLoadingRecs(false);
      }
    }
    cargar();
    return () => { cancelado = true; controller.abort(); };
  }, [favoritos, favoritosSet]);

  // Más vendidos
  useEffect(() => {
    const controller = new AbortController();
    let cancelado = false;
    async function cargar() {
      setLoadingVendidos(true);
      try {
        const res = await fetchCatalogoPage({ page: 1, perPage: 10, ordering: "-ventas", signal: controller.signal });
        if (!cancelado) setMasVendidos(res.books);
      } catch {
        if (!cancelado) setMasVendidos([]);
      } finally {
        if (!cancelado) setLoadingVendidos(false);
      }
    }
    cargar();
    return () => { cancelado = true; controller.abort(); };
  }, []);

  // Todos los libros: aleatorio o búsqueda
  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const requestedPage = page;
    const ordering = appliedQuery ? undefined : "random";

    fetchCatalogoPage({
      page: requestedPage,
      perPage: PER_PAGE,
      query: appliedQuery,
      ordering,
      seed: ordering === "random" ? seed : undefined,
      signal: controller.signal,
    })
      .then(({ books: nextBooks, pagination }) => {
        if (requestId !== requestIdRef.current) return;
        setBooks((current) => (requestedPage === 1 ? nextBooks : [...current, ...nextBooks]));
        setHasNext(Boolean(pagination?.has_next));
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el catálogo.");
        setHasNext(false);
      })
      .finally(() => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        loadingMoreRef.current = false;
        setLoadingInitial(false);
        setLoadingMore(false);
      });

    return () => controller.abort();
  }, [appliedQuery, page, reloadKey, seed]);

  const loadMore = useCallback(() => {
    if (loadingInitial || loadingMore || loadingMoreRef.current || !hasNext) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPage((p) => p + 1);
  }, [hasNext, loadingInitial, loadingMore]);

  useEffect(() => {
    if (tab !== "catalogo") return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: "400px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, tab]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
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
      setReloadKey((k) => k + 1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const retry = useCallback(() => {
    requestIdRef.current += 1;
    setError(null);
    setHasNext(true);
    if (books.length === 0) setLoadingInitial(true);
    else { loadingMoreRef.current = true; setLoadingMore(true); }
    setReloadKey((k) => k + 1);
  }, [books.length]);

  // Favoritos tab data
  useEffect(() => {
    if (tab !== "favoritos") return;
    const controller = new AbortController();
    let cancelado = false;
    async function cargarFavoritos() {
      if (favoritos.length === 0) {
        setFavoritosLibros([]); setCargandoFavoritos(false); setErrorFavoritos(null); return;
      }
      setCargandoFavoritos(true); setErrorFavoritos(null);
      try {
        const libros = await Promise.all(favoritos.map((id) => fetchCatalogoLibro(id, controller.signal).catch(() => null)));
        if (cancelado) return;
        setFavoritosLibros(libros.filter((l): l is LibroPublico => l !== null));
      } catch (e: unknown) {
        if (cancelado || controller.signal.aborted) return;
        setErrorFavoritos(e instanceof Error ? e.message : "No se pudieron cargar los favoritos.");
      } finally {
        if (!cancelado) setCargandoFavoritos(false);
      }
    }
    cargarFavoritos();
    return () => { cancelado = true; controller.abort(); };
  }, [tab, favoritos]);

  // Carrito tab data
  useEffect(() => {
    if (tab !== "carrito") return;
    const missing = Array.from(new Set(carrito.map((i) => i.libroId))).filter((id) => !carritoLibros[id]);
    if (missing.length === 0) return;
    const controller = new AbortController();
    let cancelado = false;
    async function cargarCarrito() {
      setCargandoCarrito(true);
      try {
        const libros = await Promise.all(missing.map((id) => fetchCatalogoLibro(id, controller.signal).catch(() => null)));
        if (cancelado) return;
        setCarritoLibros((actual) => {
          const next = { ...actual }; let cambio = false;
          libros.forEach((l) => { if (l && !next[l.id]) { next[l.id] = l; cambio = true; } });
          return cambio ? next : actual;
        });
      } finally {
        if (!cancelado) setCargandoCarrito(false);
      }
    }
    cargarCarrito();
    return () => { cancelado = true; controller.abort(); };
  }, [tab, carrito, carritoLibros]);

  function handleToggleFavorito(libro: LibroPublico) {
    escribirFavoritos(favoritos.includes(libro.id) ? favoritos.filter((id) => id !== libro.id) : [...favoritos, libro.id]);
  }

  const carritoCount = useMemo(() => carrito.reduce((t, i) => t + i.cantidad, 0), [carrito]);
  const totalCarrito = useMemo(() => carrito.reduce((t, item) => {
    const libro = carritoLibros[item.libroId];
    return libro ? t + precioItem(libro, item) * item.cantidad : t;
  }, 0), [carrito, carritoLibros]);

  function actualizarCantidad(item: CarritoItem, delta: number) {
    escribirCarrito(carrito.map((c) => (mismoItem(c, item) ? { ...c, cantidad: c.cantidad + delta } : c)).filter((c) => c.cantidad > 0));
  }
  function quitarDelCarrito(item: CarritoItem) {
    escribirCarrito(carrito.filter((c) => !mismoItem(c, item)));
  }

  const tabs: { id: TabId; label: string; icon: typeof Library; badge: number }[] = [
    { id: "catalogo", label: "Catálogo", icon: Library, badge: 0 },
    { id: "favoritos", label: "Favoritos", icon: Heart, badge: favoritos.length },
  ];

  const bgImage = tema === "halloween"
    ? "radial-gradient(circle at top, rgba(251,146,60,0.14), transparent 35%), linear-gradient(to bottom, #0b0614 0%, #1a1025 55%, #09040f 100%)"
    : tema === "ninguno"
      ? "linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)"
      : "url('/img/navidad/stars.svg'), linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)";
  const titleClass = tema === "halloween" ? "from-orange-300 via-amber-100 to-orange-300" : "from-amber-200 via-yellow-50 to-amber-200";

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-slate-950"
      style={{ backgroundImage: bgImage, backgroundRepeat: tema === "navidad" ? "repeat, no-repeat" : "no-repeat", backgroundSize: "cover" }}
    >
      <CatalogoDecoracion tema={tema} />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-28 md:px-8 md:pt-32">
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="rounded-2xl border border-amber-300/40 bg-white/95 p-3 shadow-[0_0_50px_rgba(251,191,36,0.18)]">
            <Image src="/img/logo.jpg" alt="Vargas Editorial" width={260} height={120} priority className="h-auto max-h-16 w-auto object-contain" />
          </div>
          <CatalogoSeasonBanner tema={tema} />
          <h1 className={`mt-5 bg-gradient-to-r ${titleClass} bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-[0_2px_10px_rgba(251,191,36,0.25)] md:text-5xl`}>Vargas Editorial</h1>
          <p className="mt-2 text-sm text-slate-300 md:text-base">Catálogo público de encuadernación y edición.</p>
        </header>

        <nav id="catalogo-secciones" className="mb-6 flex flex-wrap items-center justify-center gap-2" aria-label="Secciones de la tienda">
          {tabs.map((item) => {
            const Icon = item.icon;
            const activo = tab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-pressed={activo}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${activo ? "border-amber-300 bg-red-600 text-white shadow-lg shadow-red-900/40" : "border-white/15 bg-white/10 text-slate-100 backdrop-blur hover:bg-white/20"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
                {item.badge > 0 ? <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${activo ? "bg-amber-300 text-red-950" : "bg-white/15 text-slate-100"}`}>{item.badge}</span> : null}
              </button>
            );
          })}
          <motion.button type="button" onClick={() => setTab("carrito")} aria-pressed={tab === "carrito"}
            whileHover={reduceMotion ? undefined : { scale: 1.05, rotate: 2 }} whileTap={reduceMotion ? undefined : { scale: 0.92, rotate: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className={`relative inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${tab === "carrito" ? "border-amber-300 bg-red-600 text-white shadow-lg shadow-red-900/40" : "border-white/15 bg-white/10 text-slate-100 backdrop-blur hover:bg-white/20"}`}>
            <span className="relative inline-flex">
              <SantaIcon className="h-5 w-5" />
              {carritoCount > 0 ? <motion.span key={carritoCount} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[10px] font-extrabold text-red-950 shadow">{carritoCount}</motion.span> : null}
            </span>
            Carrito
          </motion.button>
        </nav>

        {tab === "catalogo" ? (
          <div className="space-y-8">
            {/* Sección 1: Recomendaciones personalizadas */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
              <div className="mb-4">
                <h2 className="text-xl font-extrabold text-amber-100">{recLabel}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {favoritos.length > 0 ? "Selección basada en tus favoritos y compras de otros clientes." : "Descubre títulos populares de Vargas Editorial."}
                </p>
              </div>
              {loadingRecs ? (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Cargando recomendaciones...</div>
              ) : recomendados.length > 0 ? (
                <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
                  <div className="flex gap-3 sm:gap-4" style={{ minWidth: "max-content" }}>
                    {recomendados.map((libro) => (
                      <div key={libro.id} className="w-[220px] shrink-0 snap-start sm:w-[260px] lg:w-[280px]">
                        <ShopBookCard libro={libro} favorito={favoritosSet.has(libro.id)} onToggleFavorito={handleToggleFavorito} href={`/catalogo/${libro.id}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Marca favoritos para recibir recomendaciones personalizadas.</p>
              )}
            </section>

            <div className="overflow-hidden rounded-2xl border border-amber-300/20 shadow-2xl shadow-black/30">
              <Image
                src="/img/catalogo/banner-1.png"
                alt="Banner Vargas Editorial"
                width={1921}
                height={721}
                className="h-auto w-full object-cover"
                sizes="(max-width: 1280px) 100vw, 1280px"
              />
            </div>

            {/* Sección 2: Más vendidos */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
              <div className="mb-4">
                <h2 className="text-xl font-extrabold text-amber-100">Más vendidos</h2>
                <p className="mt-1 text-sm text-slate-400">Los títulos más pedidos por nuestros clientes.</p>
              </div>
              {loadingVendidos ? (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Cargando más vendidos...</div>
              ) : masVendidos.length > 0 ? (
                <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
                  <div className="flex gap-3 sm:gap-4" style={{ minWidth: "max-content" }}>
                    {masVendidos.map((libro) => (
                      <div key={libro.id} className="w-[220px] shrink-0 snap-start sm:w-[260px] lg:w-[280px]">
                        <ShopBookCard libro={libro} favorito={favoritosSet.has(libro.id)} onToggleFavorito={handleToggleFavorito} href={`/catalogo/${libro.id}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Aún no hay datos de ventas.</p>
              )}
            </section>

            {/* Sección 3: Todos los libros */}
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
              favoritos={favoritosSet}
              onToggleFavorito={handleToggleFavorito}
            />
          </div>
        ) : null}

        {tab === "favoritos" ? (
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-amber-100">Tus favoritos</h2>
              <p className="mt-1 text-sm text-slate-400">Los libros que guardaste para comprar más tarde.</p>
            </div>
            {cargandoFavoritos ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm font-medium text-slate-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Cargando favoritos...</div>
            ) : errorFavoritos ? (
              <p className="rounded-lg border border-red-400/30 bg-red-950/40 px-4 py-6 text-center text-sm text-red-200">{errorFavoritos}</p>
            ) : favoritosLibros.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-400">
                <Heart className="mx-auto mb-3 h-8 w-8 text-slate-600" aria-hidden="true" />
                <p className="font-semibold text-slate-200">Aún no tienes libros favoritos.</p>
                <p className="mt-1">Toca el corazón (o el regalo) en cualquier libro para guardarlo aquí.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {favoritosLibros.map((libro) => (
                  <ShopBookCard key={libro.id} libro={libro} favorito={favoritosSet.has(libro.id)} onToggleFavorito={handleToggleFavorito} href={`/catalogo/${libro.id}`} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {tab === "carrito" ? (
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-amber-100">Tu carrito</h2>
              <p className="mt-1 text-sm text-slate-400">Revisa los libros y acabados antes de confirmar tu pedido.</p>
            </div>
            {carrito.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-400">
                <SantaIcon className="mx-auto mb-3 h-10 w-10" />
                <p className="font-semibold text-slate-200">Tu carrito está vacío.</p>
                <p className="mt-1">Explora el catálogo y agrega los libros que quieras comprar.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {carrito.map((item) => {
                  const libro = carritoLibros[item.libroId];
                  const precioUnitario = libro ? precioItem(libro, item) : 0;
                  return (
                    <div key={`${item.libroId}-${item.esquineros}-${item.cantosPintados}`} className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-bold text-slate-100">{libro ? libro.titulo : `Libro #${item.libroId}`}</p>
                          {libro && !libro.disponible ? <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-200">Agotado</span> : null}
                        </div>
                        <p className="truncate text-sm text-slate-400">{libro ? libro.autor || "Autor desconocido" : "No disponible"}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {item.esquineros || item.cantosPintados ? <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-slate-300">Esquineros</span> : null}
                          {item.cantosPintados ? <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-slate-300">Cantos pintados</span> : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{money(precioUnitario, "CUP")} por unidad</p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => actualizarCantidad(item, -1)} className="rounded-md border border-white/10 bg-slate-800 p-1.5 text-slate-100 transition hover:bg-slate-700" aria-label="Disminuir cantidad"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                          <span className="w-8 text-center text-sm font-bold text-slate-100">{item.cantidad}</span>
                          <button type="button" onClick={() => actualizarCantidad(item, 1)} className="rounded-md border border-white/10 bg-slate-800 p-1.5 text-slate-100 transition hover:bg-slate-700" aria-label="Aumentar cantidad"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                        </div>
                        <span className="min-w-24 text-right text-base font-extrabold text-amber-300">{money(precioUnitario * item.cantidad, "CUP")}</span>
                        <button type="button" onClick={() => quitarDelCarrito(item)} className="rounded-md p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400" aria-label="Quitar del carrito"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total del carrito</p>
                    <p className="text-2xl font-extrabold text-amber-300">{money(totalCarrito, "CUP")}</p>
                    {cargandoCarrito ? <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Actualizando precios...</p> : null}
                  </div>
                  <Link href="/catalogo/checkout" className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/50 bg-gradient-to-r from-red-600 to-red-700 px-5 py-2.5 text-sm font-bold text-amber-50 shadow-lg shadow-red-900/40 transition hover:from-red-500 hover:to-red-600">
                    <Gift className="h-4 w-4" aria-hidden="true" />
                    Ir a confirmar pedido
                  </Link>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Library, Loader2, Search, ShoppingCart, X } from "lucide-react";
import SantaIcon from "@/components/catalogos/SantaIcon";
import { fetchCatalogoPage, type LibroPublico } from "@/lib/catalogos";
import { money } from "@/lib/format";

export type SeccionCatalogo = "catalogo" | "favoritos";

type CatalogoNavbarProps = {
  query?: string;
  onQueryChange?: (valor: string) => void;
  seccion?: SeccionCatalogo;
  onSeccionChange?: (seccion: SeccionCatalogo) => void;
  onCarritoClick?: () => void;
  favoritosCount?: number;
  carritoCount?: number;
};

export default function CatalogoNavbar({
  query = "",
  onQueryChange,
  seccion,
  onSeccionChange,
  onCarritoClick,
  favoritosCount = 0,
  carritoCount = 0,
}: CatalogoNavbarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const [texto, setTexto] = useState(query);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [resultados, setResultados] = useState<LibroPublico[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [libroDestino, setLibroDestino] = useState<LibroPublico | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (modalAbierto) {
      modalInputRef.current?.focus();
    }
  }, [modalAbierto]);

  useEffect(() => {
    if (!libroDestino) {
      return;
    }
    const temporizador = window.setTimeout(() => setLibroDestino(null), 10000);
    return () => window.clearTimeout(temporizador);
  }, [libroDestino]);

  function cancelarBusqueda() {
    controllerRef.current?.abort();
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setBuscando(false);
  }

  function cerrarModal(devolverFoco = false) {
    cancelarBusqueda();
    setModalAbierto(false);
    if (devolverFoco) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function buscarEnVivo(valor: string) {
    cancelarBusqueda();
    setModalAbierto(true);
    setBuscando(true);
    setErrorBusqueda(null);

    debounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const datos = await fetchCatalogoPage({
          page: 1,
          perPage: 8,
          query: valor.trim(),
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setResultados(datos.books);
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setErrorBusqueda(
            error instanceof Error ? error.message : "No se pudieron cargar los resultados.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setBuscando(false);
        }
      }
    }, 250);
  }

  function manejarCambio(valor: string) {
    setTexto(valor);
    onQueryChange?.(valor);
    if (!valor.trim()) {
      cerrarModal(modalAbierto);
      setResultados([]);
      return;
    }
    buscarEnVivo(valor);
  }

  function manejarBusqueda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valor = texto.trim();
    cerrarModal();
    router.push(valor ? `/catalogo?q=${encodeURIComponent(valor)}` : "/catalogo");
  }

  function irASeccion(destino: SeccionCatalogo) {
    cerrarModal();
    if (onSeccionChange) {
      onSeccionChange(destino);
      return;
    }
    router.push(destino === "favoritos" ? "/catalogo?tab=favoritos" : "/catalogo");
  }

  function irACarrito() {
    cerrarModal();
    if (onCarritoClick) {
      onCarritoClick();
      return;
    }
    router.push("/catalogo?tab=carrito");
  }

  function abrirLibro(libro: LibroPublico) {
    cerrarModal();
    setTexto(libro.titulo);
    onQueryChange?.(libro.titulo);
    setLibroDestino(libro);
    router.push(`/catalogo/${libro.id}`);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-amber-300/20 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 md:px-8">
          <Link href="/catalogo" className="mr-auto flex items-center gap-2">
            <div className="rounded-xl border border-amber-300/40 bg-white/95 p-1.5">
              <Image
                src="/img/logo.jpg"
                alt="Vargas Editorial"
                width={150}
                height={70}
                className="h-auto max-h-8 w-auto object-contain"
                priority
              />
            </div>
          </Link>

          <form
            onSubmit={manejarBusqueda}
            role="search"
            className={`order-3 flex w-full items-center gap-2 sm:order-none sm:w-auto sm:flex-1 sm:max-w-md ${modalAbierto ? "invisible pointer-events-none" : ""}`}
          >
            <div className="relative w-full">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                ref={inputRef}
                value={texto}
                onChange={(event) => manejarCambio(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cerrarModal(true);
                }}
                placeholder="Buscar por título o autor"
                aria-label="Buscar por título o autor"
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-lg border border-amber-300/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
            >
              Buscar
            </button>
          </form>

          <nav
            id="catalogo-secciones"
            aria-label="Secciones de la tienda"
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => irASeccion("catalogo")}
              aria-pressed={seccion === "catalogo"}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:text-sm ${seccion === "catalogo" ? "border-amber-300 bg-red-600 text-white" : "border-white/15 bg-white/10 text-slate-100 hover:bg-white/20"}`}
            >
              <Library className="h-4 w-4" aria-hidden="true" />
              Catálogo
            </button>
            <button
              type="button"
              onClick={() => irASeccion("favoritos")}
              aria-pressed={seccion === "favoritos"}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:text-sm ${seccion === "favoritos" ? "border-amber-300 bg-red-600 text-white" : "border-white/15 bg-white/10 text-slate-100 hover:bg-white/20"}`}
            >
              <Heart className="h-4 w-4" aria-hidden="true" />
              Favoritos
              {favoritosCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[10px] font-extrabold text-red-950">
                  {favoritosCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={irACarrito}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/20 sm:text-sm"
            >
              <span className="relative inline-flex">
                <SantaIcon className="h-5 w-5" />
                {carritoCount > 0 ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[10px] font-extrabold text-red-950">
                    {carritoCount}
                  </span>
                ) : null}
              </span>
              <ShoppingCart className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              <span className="hidden sm:inline">Carrito</span>
            </button>
          </nav>
        </div>
      </header>

      {modalAbierto ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/70 p-4 pt-16 backdrop-blur-sm md:pt-20"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cerrarModal(true);
          }}
        >
          <div
            id="resultados-busqueda-catalogo"
            role="dialog"
            aria-modal="true"
            aria-label="Resultados de búsqueda"
            className="max-h-[78vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-amber-300/30 bg-slate-900 p-4 shadow-2xl md:p-6"
          >
            <form onSubmit={manejarBusqueda} role="search" className="mb-4">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  ref={modalInputRef}
                  value={texto}
                  onChange={(event) => manejarCambio(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") cerrarModal(true);
                  }}
                  placeholder="Buscar por título o autor"
                  aria-label="Buscar por título o autor"
                  aria-controls="lista-resultados-busqueda"
                  className="w-full rounded-lg border border-amber-300/50 bg-slate-950/80 py-2.5 pl-10 pr-20 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
                >
                  Buscar
                </button>
              </div>
            </form>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-amber-100">Resultados de búsqueda</h2>
                <p className="text-xs text-slate-400">Mostrando coincidencias para “{texto.trim()}”.</p>
              </div>
              <button
                type="button"
                onClick={() => cerrarModal(true)}
                aria-label="Cerrar resultados"
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/15"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div id="lista-resultados-busqueda">
              {buscando ? (
              <p className="flex items-center gap-2 py-8 text-sm text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Buscando libros...
              </p>
            ) : errorBusqueda ? (
              <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/40 px-4 py-6 text-center text-sm text-red-200">
                {errorBusqueda}
              </p>
            ) : resultados.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No encontramos libros con ese título o autor.</p>
            ) : (
              <ul className="space-y-2">
                {resultados.map((libro) => (
                  <li key={libro.id}>
                    <button
                      type="button"
                      onClick={() => abrirLibro(libro)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-left transition hover:border-amber-300/40 hover:bg-slate-800/70"
                    >
                      <div
                        className="h-16 w-12 shrink-0 rounded-md border border-white/10 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${JSON.stringify(libro.imagen || libro.imagen_base || "/img/logo.jpg")})`,
                        }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-100">{libro.titulo}</p>
                        <p className="truncate text-xs text-slate-400">{libro.autor || "Autor no especificado"}</p>
                        <p className="mt-1 text-xs font-semibold text-amber-200">
                          {money(libro.precio_cup_referencia ?? libro.precio_cup ?? libro.precio)}
                        </p>
                      </div>
                      {!libro.disponible ? (
                        <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          Agotado
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </div>
        </div>
      ) : null}

      {libroDestino ? (
        <div
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-9 w-9 animate-spin text-amber-300" aria-hidden="true" />
          <p className="mt-4 text-lg font-extrabold text-amber-100">Cargando detalles del libro...</p>
          <p className="mt-1 max-w-md text-sm text-slate-300">{libroDestino.titulo}</p>
        </div>
      ) : null}
    </>
  );
}

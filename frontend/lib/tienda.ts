import { useSyncExternalStore } from "react";
import { calcularPrecioConAcabados } from "./costos";
import type { LibroPublico } from "./catalogos";

export const FAVORITOS_KEY = "vargas_catalogo_favoritos";
export const CARRITO_KEY = "vargas_catalogo_carrito";

export type CarritoItem = {
  libroId: number;
  cantidad: number;
  esquineros: boolean;
  cantosPintados: boolean;
};

function normalizarFavoritos(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (id): id is number =>
          typeof id === "number" && Number.isInteger(id) && id > 0,
      ),
    ),
  );
}

function normalizarItem(value: unknown): CarritoItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<CarritoItem>;

  if (
    typeof item.libroId !== "number" ||
    !Number.isInteger(item.libroId) ||
    item.libroId <= 0
  ) {
    return null;
  }

  const cantidad = Number(item.cantidad);

  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return null;
  }

  return {
    libroId: item.libroId,
    cantidad,
    esquineros: Boolean(item.esquineros),
    cantosPintados: Boolean(item.cantosPintados),
  };
}

function normalizarCarrito(value: unknown): CarritoItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizarItem)
    .filter((item): item is CarritoItem => item !== null);
}

export function leerFavoritos(): number[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FAVORITOS_KEY);
    return raw ? normalizarFavoritos(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function guardarFavoritos(favoritos: number[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    FAVORITOS_KEY,
    JSON.stringify(normalizarFavoritos(favoritos)),
  );
}

export function leerCarrito(): CarritoItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CARRITO_KEY);
    return raw ? normalizarCarrito(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function guardarCarrito(carrito: CarritoItem[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    CARRITO_KEY,
    JSON.stringify(normalizarCarrito(carrito)),
  );
}

const EMPTY_FAVORITOS: number[] = [];
const EMPTY_CARRITO: CarritoItem[] = [];

let favoritosCache: number[] | null = null;
let carritoCache: CarritoItem[] | null = null;
const tiendaListeners = new Set<() => void>();

function emitirTienda(): void {
  tiendaListeners.forEach((listener) => listener());
}

function subscribeTienda(listener: () => void): () => void {
  tiendaListeners.add(listener);
  return () => {
    tiendaListeners.delete(listener);
  };
}

function getFavoritosSnapshot(): number[] {
  if (favoritosCache === null) {
    favoritosCache = leerFavoritos();
  }

  return favoritosCache;
}

function getCarritoSnapshot(): CarritoItem[] {
  if (carritoCache === null) {
    carritoCache = leerCarrito();
  }

  return carritoCache;
}

function getFavoritosServerSnapshot(): number[] {
  return EMPTY_FAVORITOS;
}

function getCarritoServerSnapshot(): CarritoItem[] {
  return EMPTY_CARRITO;
}

export function useFavoritos(): number[] {
  return useSyncExternalStore(
    subscribeTienda,
    getFavoritosSnapshot,
    getFavoritosServerSnapshot,
  );
}

export function useCarrito(): CarritoItem[] {
  return useSyncExternalStore(
    subscribeTienda,
    getCarritoSnapshot,
    getCarritoServerSnapshot,
  );
}

export function escribirFavoritos(next: number[]): void {
  favoritosCache = normalizarFavoritos(next);
  guardarFavoritos(favoritosCache);
  emitirTienda();
}

export function escribirCarrito(next: CarritoItem[]): void {
  carritoCache = normalizarCarrito(next);
  guardarCarrito(carritoCache);
  emitirTienda();
}

export function precioItemCup(libro: LibroPublico, item: Pick<CarritoItem, "esquineros" | "cantosPintados">): number {
  const precioBase = Number(libro.precio_cup_referencia ?? libro.precio_cup ?? libro.precio) || 0;
  return calcularPrecioConAcabados(precioBase, item.cantosPintados, item.esquineros);
}

export function precioItemUsd(libro: LibroPublico, item: Pick<CarritoItem, "esquineros" | "cantosPintados">): number {
  const baseUsd = Number(libro.precio_usd ?? 0) || 0;
  const baseCup = Number(libro.precio_cup_referencia ?? libro.precio_cup ?? libro.precio) || 0;
  const finalCup = precioItemCup(libro, item);
  if (!baseCup) return 0;
  return (baseUsd * finalCup) / baseCup;
}

export function precioItem(libro: LibroPublico, item: Pick<CarritoItem, "esquineros" | "cantosPintados">): number {
  return precioItemCup(libro, item);
}

export function totalItem(libro: LibroPublico, item: CarritoItem): number {
  return precioItem(libro, item) * item.cantidad;
}

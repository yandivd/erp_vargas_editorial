"use client";

import Link from "next/link";
import { Gift, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import SantaIcon from "@/components/catalogos/SantaIcon";
import type { LibroPublico } from "@/lib/catalogos";
import { money } from "@/lib/format";
import type { CarritoItem } from "@/lib/tienda";

type CartDrawerProps = {
  abierto: boolean;
  onClose: () => void;
  items: CarritoItem[];
  libros: Record<number, LibroPublico>;
  precioItem: (
    libro: LibroPublico,
    item: Pick<CarritoItem, "esquineros" | "cantosPintados">,
  ) => number;
  total: number;
  cargando: boolean;
  onCantidad: (item: CarritoItem, delta: number) => void;
  onQuitar: (item: CarritoItem) => void;
  onVaciar: () => void;
};

export default function CartDrawer({
  abierto,
  onClose,
  items,
  libros,
  precioItem,
  total,
  cargando,
  onCantidad,
  onQuitar,
  onVaciar,
}: CartDrawerProps) {
  if (!abierto) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Carrito"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-slate-900/95 p-4 shadow-2xl md:p-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-amber-100">Tu carrito</h2>
            <p className="mt-1 text-sm text-slate-400">Revisa los libros y acabados antes de confirmar tu pedido.</p>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 ? (
              <button type="button" onClick={onVaciar} className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-950/50">
                <Trash2 className="h-4 w-4" aria-hidden="true" />Vaciar
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">Cerrar</button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            <SantaIcon className="mx-auto mb-3 h-10 w-10" />
            <p className="font-semibold text-slate-200">Tu carrito está vacío.</p>
            <p className="mt-1">Explora el catálogo y agrega los libros que quieras comprar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const libro = libros[item.libroId];
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
                      <button type="button" onClick={() => onCantidad(item, -1)} className="rounded-md border border-white/10 bg-slate-800 p-1.5 text-slate-100 transition hover:bg-slate-700" aria-label="Disminuir cantidad"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                      <span className="w-8 text-center text-sm font-bold text-slate-100">{item.cantidad}</span>
                      <button type="button" onClick={() => onCantidad(item, 1)} className="rounded-md border border-white/10 bg-slate-800 p-1.5 text-slate-100 transition hover:bg-slate-700" aria-label="Aumentar cantidad"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                    <span className="min-w-24 text-right text-base font-extrabold text-amber-300">{money(precioUnitario * item.cantidad, "CUP")}</span>
                    <button type="button" onClick={() => onQuitar(item)} className="rounded-md p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400" aria-label="Quitar del carrito"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">Total del carrito</p>
                <p className="text-2xl font-extrabold text-amber-300">{money(total, "CUP")}</p>
                {cargando ? <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Actualizando precios...</p> : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Link href="/catalogo/checkout" className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/50 bg-gradient-to-r from-red-600 to-red-700 px-5 py-2.5 text-sm font-bold text-amber-50 shadow-lg shadow-red-900/40 transition hover:from-red-500 hover:to-red-600">
                  <Gift className="h-4 w-4" aria-hidden="true" />Ir a confirmar pedido
                </Link>
                <p className="max-w-xs text-right text-[11px] text-slate-400">El ANTICIPO puede ser depositado en efectivo o transferencia, pero el saldo restante debe ser pagado en efectivo junto con la mensajeria en caso de requerirla</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

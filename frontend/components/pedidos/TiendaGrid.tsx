"use client";

import { useState } from "react";
import { BookOpen, ShoppingCart } from "lucide-react";
import { money } from "@/lib/format";
import type { PedidoListItem } from "@/lib/pedidos";
import TiendaModal from "./TiendaModal";

type TiendaGridProps = {
  pedidos: PedidoListItem[];
};

export default function TiendaGrid({ pedidos }: TiendaGridProps) {
  const [selectedPedidoId, setSelectedPedidoId] = useState<number | null>(
    null,
  );
  const selected = pedidos.find((pedido) => pedido.id === selectedPedidoId) ?? null;
  const selectedPrecio = selected ? Number(selected.precio_venta) : 0;

  if (pedidos.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white px-4 py-12 text-center text-sm text-muted">
        <p className="font-semibold text-ink">No hay libros en stock para vender.</p>
        <p className="mt-1">Vuelve más tarde para ver la tienda.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {pedidos.map((pedido) => (
          <article
            key={pedido.id}
            className="flex flex-col rounded-xl border border-line p-5 transition hover:bg-slate-50"
          >
            <div className="mb-4 flex h-36 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <BookOpen className="h-10 w-10" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-ink">{pedido.libro_titulo}</h3>
            <p className="text-sm text-muted">
              {pedido.libro_autor || "Sin autor"}
            </p>
            <p className="mt-2 text-sm text-muted">
              Cantidad: {pedido.cantidad}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Precio
                </div>
                <div className="text-lg font-bold text-brand">
                  {money(pedido.precio_venta)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPedidoId(pedido.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Vender
              </button>
            </div>
          </article>
        ))}
      </div>

      {selected ? (
        <TiendaModal
          pedidoId={selected.id}
          precio={selectedPrecio}
          onClose={() => setSelectedPedidoId(null)}
        />
      ) : null}
    </>
  );
}

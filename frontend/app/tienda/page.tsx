import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import TiendaGrid from "@/components/pedidos/TiendaGrid";
import { apiFetch } from "@/lib/api";
import type { PedidoListItem } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

export default async function TiendaPage() {
  let pedidos: PedidoListItem[] = [];
  let error: string | null = null;

  try {
    pedidos = await apiFetch<PedidoListItem[]>("tienda/");
  } catch (requestError) {
    error =
      requestError instanceof Error
        ? requestError.message
        : "No se pudo cargar la tienda.";
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink">
            Tienda
          </h1>
          <p className="mt-1 text-sm text-muted">
            Libros de stock listos para vender.
          </p>
        </div>
        <Link
          href="/pedidos"
          className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
        >
          Volver a pedidos
        </Link>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar la tienda.</strong>
            <div>{error}</div>
          </div>
        </div>
      ) : (
        <TiendaGrid pedidos={pedidos} />
      )}
    </div>
  );
}

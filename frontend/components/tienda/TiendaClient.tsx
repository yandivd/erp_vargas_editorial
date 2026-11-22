"use client";
import { SearchX, Store } from "lucide-react";
import Link from "next/link";
import TiendaGrid from "@/components/pedidos/TiendaGrid";
import TableControls from "@/components/ui/TableControls";
import { useTable } from "@/lib/useTable";
import type { PedidoListItem } from "@/lib/pedidos";

export default function TiendaClient({ initialPedidos }: { initialPedidos: PedidoListItem[] }) {
  const t = useTable(initialPedidos, {
    searchKeys: (p: any) => [p.libro?.titulo, p.libro_titulo, p.cliente?.nombre, p.cliente_nombre, String(p.id)],
    pageSize: 12,
  });
  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink"><Store className="h-7 w-7 text-brand" />Tienda</h1><p className="mt-1 text-sm text-muted">Libros de stock listos para vender.</p></div>
        <Link href="/pedidos" className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50">Volver a pedidos</Link>
      </header>
      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls search={t.search} onSearch={t.setSearch} filters={t.filters} onFilter={t.setFilter} filterDefs={[]} page={t.page} totalPages={t.totalPages} total={t.total} start={t.start} end={t.end} onPage={t.setPage} />
        {t.pageRows.length === 0 ? <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted"><SearchX className="mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-ink">No hay resultados</p></div> : <TiendaGrid pedidos={t.pageRows} />}
      </section>
    </div>
  );
}

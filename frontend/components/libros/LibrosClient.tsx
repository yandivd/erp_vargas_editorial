"use client";
import { BookOpen, SearchX } from "lucide-react";
import Link from "next/link";
import LibroModal from "@/components/libros/LibroModal";
import BookImage from "@/components/libros/BookImage";
import TableControls from "@/components/ui/TableControls";
import { tableClass, tableRowClass, tableWrapClass, tdClass, thClass } from "@/components/dashboard/ui";
import { money } from "@/lib/format";
import { useTable } from "@/lib/useTable";
import type { Libro } from "@/lib/libros";

export default function LibrosClient({ initialLibros }: { initialLibros: Libro[] }) {
  const t = useTable(initialLibros, {
    searchKeys: (l) => [l.titulo, l.autor, String(l.paginas)],
    filters: {
      disponibilidad: (l, v) => v === "disponible" ? !!l.disponible : v === "no" ? !l.disponible : true,
      catalogo: (l, v) => v === "visible" ? !l.oculto_catalogo : v === "oculto" ? !!l.oculto_catalogo : true,
    },
  });
  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink"><BookOpen className="h-7 w-7 text-brand" />Libros</h1>
          <p className="mt-1 text-sm text-muted">Catálogo de libros, portadas y precios de venta.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted"><span className="font-bold text-ink">{t.total}</span> libro{t.total === 1 ? "" : "s"}</div>
          <LibroModal />
        </div>
      </div>
      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls search={t.search} onSearch={t.setSearch} filters={t.filters} onFilter={t.setFilter}
          filterDefs={[
            { key: "disponibilidad", label: "Disponibilidad", options: [{ value: "disponible", label: "Disponible" }, { value: "no", label: "No disponible" }] },
            { key: "catalogo", label: "Catálogo", options: [{ value: "visible", label: "Visible" }, { value: "oculto", label: "Oculto" }] },
          ]}
          total={t.total} page={t.page} totalPages={t.totalPages} start={t.start} end={t.end} onPage={t.setPage} />
        {t.pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted"><SearchX className="mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-ink">No encontramos libros</p></div>
        ) : (
          <div className={tableWrapClass}><table className={tableClass}><thead><tr>
            <th className={`${thClass} w-28`}>Portada</th><th className={thClass}>Título</th><th className={`${thClass} hidden sm:table-cell`}>Autor</th><th className={thClass}>Páginas</th><th className={thClass}>Precio</th><th className={`${thClass} text-right`}><span className="sr-only">Acciones</span></th>
          </tr></thead><tbody>{t.pageRows.map((libro) => (
            <tr key={libro.id} className={tableRowClass}>
              <td className={tdClass}><BookImage libro={libro} className="aspect-[3/4] w-20 rounded-md border border-line sm:w-24" /></td>
              <td className={tdClass}><Link href={`/libros/${libro.id}`} className="font-semibold text-ink transition hover:text-brand">{libro.titulo}</Link>{libro.oculto_catalogo ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-800">Oculto del catálogo</span> : null}<div className="text-[0.75rem] text-muted sm:hidden">{libro.autor || "Sin autor"}</div></td>
              <td className={`${tdClass} hidden sm:table-cell`}>{libro.autor || "—"}</td>
              <td className={tdClass}>{libro.paginas}</td>
              <td className={tdClass}><div>{money(libro.precio_usd ?? 0, "USD")}</div><div className="text-xs text-muted">{money(libro.precio_cup_referencia ?? libro.precio, "CUP")}</div></td>
              <td className={`${tdClass} text-right`}><LibroModal libro={libro} /></td>
            </tr>
          ))}</tbody></table></div>
        )}
      </section>
    </div>
  );
}

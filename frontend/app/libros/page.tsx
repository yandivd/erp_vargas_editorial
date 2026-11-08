import { AlertTriangle, BookOpen, SearchX } from "lucide-react";
import Link from "next/link";
import LibroModal from "@/components/libros/LibroModal";
import LibrosFilters from "@/components/libros/LibrosFilters";
import { apiFetchEnvelope } from "@/lib/api";
import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { money } from "@/lib/format";
import { libroImagenSrc, type Libro } from "@/lib/libros";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    search?: string;
  }>;
};

export default async function LibrosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = (params.search ?? "").trim();

  const query = new URLSearchParams();
  if (search) {
    query.set("search", search);
  }

  const path = query.toString() ? `libros/?${query.toString()}` : "libros/";

  const result = await apiFetchEnvelope<Libro[]>(path)
    .then((envelope) => ({ envelope, error: null }))
    .catch((error: unknown) => ({
      envelope: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los libros.",
    }));

  if (result.error || !result.envelope) {
    return (
      <div>
        <PageHeader />
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar los libros.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const libros = result.envelope.data ?? [];

  return (
    <div>
      <PageHeader count={libros.length} />

      <LibrosFilters initialSearch={search} />

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        {libros.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
            <SearchX className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-ink">No encontramos libros</p>
            <p className="mt-1 text-sm">
              Ajusta la búsqueda o registra un nuevo libro.
            </p>
          </div>
        ) : (
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={`${thClass} w-28`}>Portada</th>
                  <th className={thClass}>Título</th>
                  <th className={`${thClass} hidden sm:table-cell`}>Autor</th>
                  <th className={thClass}>Páginas</th>
                  <th className={thClass}>Precio</th>
                  <th className={`${thClass} text-right`}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {libros.map((libro) => (
                  <tr key={libro.id} className={tableRowClass}>
                    <td className={tdClass}>
                      <div className="aspect-[21/9] w-24 overflow-hidden rounded-md border border-line bg-slate-50 sm:w-28">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={libroImagenSrc(libro.imagen)}
                          alt={`Portada de ${libro.titulo}`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </td>
                    <td className={tdClass}>
                      <Link
                        href={`/libros/${libro.id}`}
                        className="font-semibold text-ink transition hover:text-brand"
                      >
                        {libro.titulo}
                      </Link>
                      <div className="text-[0.75rem] text-muted sm:hidden">
                        {libro.autor || "Sin autor"}
                      </div>
                    </td>
                    <td className={`${tdClass} hidden sm:table-cell`}>
                      {libro.autor || "—"}
                    </td>
                    <td className={tdClass}>{libro.paginas}</td>
                    <td className={tdClass}>{money(libro.precio)}</td>
                    <td className={`${tdClass} text-right`}>
                      <LibroModal libro={libro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PageHeader({ count }: { count?: number }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
          <BookOpen className="h-7 w-7 text-brand" aria-hidden="true" />
          Libros
        </h1>
        <p className="mt-1 text-sm text-muted">
          Catálogo de libros, portadas y precios de venta.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {typeof count === "number" ? (
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
            <span className="font-bold text-ink">{count}</span> libro
            {count === 1 ? "" : "s"}
          </div>
        ) : null}
        <LibroModal />
      </div>
    </div>
  );
}

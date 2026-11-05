import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ApiPagination } from "@/lib/api";

type PedidosPaginationProps = {
  pagination: ApiPagination;
  search: string;
  estado: string;
  enTaller: boolean;
};

function hrefForPage(
  page: number,
  search: string,
  estado: string,
  enTaller: boolean,
): string {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }
  if (estado) {
    params.set("estado", estado);
  }
  params.set("en_taller", enTaller ? "true" : "false");
  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/pedidos?${query}` : "/pedidos";
}

function visiblePages(current: number, total: number): number[] {
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
}

export default function PedidosPagination({
  pagination,
  search,
  estado,
  enTaller,
}: PedidosPaginationProps) {
  if (pagination.num_pages <= 1) {
    return (
      <div className="mt-3 text-sm text-muted">
        {pagination.count} pedido{pagination.count === 1 ? "" : "s"}
      </div>
    );
  }

  const pages = visiblePages(pagination.page, pagination.num_pages);
  const linkClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-line px-2 text-sm font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand";
  const activeClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-brand bg-brand px-2 text-sm font-semibold text-white";
  const disabledClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-line px-2 text-sm font-semibold text-slate-300";

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted">
        Mostrando {pagination.start_index}–{pagination.end_index} de{" "}
        {pagination.count}
      </div>

      <nav
        className="flex items-center gap-1.5"
        aria-label="Paginación de pedidos"
      >
        {pagination.has_previous ? (
          <Link
            href={hrefForPage(pagination.page - 1, search, estado, enTaller)}
            className={linkClass}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className={disabledClass} aria-hidden="true">
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        {pages.map((page, index) => {
          const previous = pages[index - 1];
          const gap = previous && page - previous > 1;

          return (
            <span key={page} className="flex items-center gap-1.5">
              {gap ? <span className="px-1 text-muted">…</span> : null}
              {page === pagination.page ? (
                <span className={activeClass} aria-current="page">
                  {page}
                </span>
              ) : (
                <Link
                  href={hrefForPage(page, search, estado, enTaller)}
                  className={linkClass}
                >
                  {page}
                </Link>
              )}
            </span>
          );
        })}

        {pagination.has_next ? (
          <Link
            href={hrefForPage(pagination.page + 1, search, estado, enTaller)}
            className={linkClass}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className={disabledClass} aria-hidden="true">
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </nav>
    </div>
  );
}

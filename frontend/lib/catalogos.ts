import type { ApiPagination } from "@/lib/api";

export type LibroPublico = {
  id: number;
  titulo: string;
  autor: string;
  descripcion?: string;
  paginas?: number;
  precio: string;
};

export type CatalogoPage = {
  books: LibroPublico[];
  pagination: ApiPagination | null;
};

type FetchCatalogoPageOptions = {
  page: number;
  perPage: number;
  query?: string;
  signal?: AbortSignal;
};

type CatalogoEnvelope = {
  ok: boolean;
  data?: LibroPublico[];
  pagination?: ApiPagination | null;
  error?: string;
};

export async function fetchCatalogoPage({
  page,
  perPage,
  query,
  signal,
}: FetchCatalogoPageOptions): Promise<CatalogoPage> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const normalizedQuery = query?.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  const response = await fetch(`/api/catalogo?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | CatalogoEnvelope
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error ?? `No se pudo cargar el catálogo (HTTP ${response.status}).`,
    );
  }

  return {
    books: payload.data ?? [],
    pagination: payload.pagination ?? null,
  };
}

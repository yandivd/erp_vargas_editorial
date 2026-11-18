import type { ApiPagination } from "@/lib/api";

export type LibroPublico = {
  id: number;
  titulo: string;
  autor: string;
  descripcion?: string;
  paginas?: number;
  precio: string;
  imagen?: string | null;
  disponible: boolean;
  descuento?: boolean | number | null;
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

type LibroEnvelope = {
  ok: boolean;
  data?: LibroPublico;
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

export async function fetchCatalogoLibro(
  id: number,
  signal?: AbortSignal,
): Promise<LibroPublico> {
  const response = await fetch(`/api/catalogo/libros/${id}`, {
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | LibroEnvelope
    | null;

  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(
      payload?.error ?? `No se pudo cargar el libro (HTTP ${response.status}).`,
    );
  }

  return payload.data;
}

export async function fetchRecomendaciones(
  id: number,
  favoritos: number[],
  signal?: AbortSignal,
): Promise<LibroPublico[]> {
  const params = new URLSearchParams();

  if (favoritos.length > 0) {
    params.set("favoritos", favoritos.join(","));
  }

  const query = params.toString();
  const response = await fetch(
    `/api/catalogo/libros/${id}/recomendaciones${query ? `?${query}` : ""}`,
    {
      signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | CatalogoEnvelope
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error ??
        `No se pudieron cargar las recomendaciones (HTTP ${response.status}).`,
    );
  }

  return payload.data ?? [];
}

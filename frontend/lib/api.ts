export type ApiPagination = {
  count: number;
  page: number;
  num_pages: number;
  per_page: number;
  start_index: number;
  end_index: number;
  has_next: boolean;
  has_previous: boolean;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  pagination?: ApiPagination | null;
  meta?: unknown;
};

export type ApiFailure = {
  ok: false;
  error: string;
  status?: number;
  details?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const isServer = typeof window === "undefined";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getBaseUrl(): string {
  if (isServer) {
    const baseUrl = process.env.DJANGO_API_URL;

    if (!baseUrl) {
      throw new ApiError("Falta DJANGO_API_URL en el servidor.", 500);
    }

    return normalizeBaseUrl(baseUrl);
  }

  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BFF_BASE_URL ?? "/api/bff",
  );
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${getBaseUrl()}/${path.replace(/^\/+/, "")}`;
}

async function getServerAccessToken(): Promise<string | undefined> {
  if (!isServer) {
    return undefined;
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieName =
    process.env.JWT_ACCESS_COOKIE_NAME ?? "erp_access";

  return cookieStore.get(cookieName)?.value;
}

function isApiEnvelope(
  value: unknown,
): value is ApiSuccess<unknown> | ApiFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof (value as { ok?: unknown }).ok === "boolean"
  );
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;

    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  }

  return fallback;
}

export async function apiFetchEnvelope<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiSuccess<T>> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (init.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = await getServerAccessToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      ...init,
      headers,
      cache: init.cache ?? "no-store",
    });
  } catch (error) {
    throw new ApiError(
      "No se pudo conectar con el servidor.",
      502,
      error,
    );
  }

  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, `Error HTTP ${response.status}`),
      response.status,
      payload,
    );
  }

  if (!isApiEnvelope(payload)) {
    throw new ApiError(
      "Respuesta inválida del servidor.",
      502,
      payload,
    );
  }

  if (!payload.ok) {
    throw new ApiError(payload.error, response.status, payload);
  }

  return payload as ApiSuccess<T>;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const payload = await apiFetchEnvelope<T>(path, init);
  return payload.data;
}

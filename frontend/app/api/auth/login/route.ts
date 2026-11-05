import { NextResponse } from "next/server";

type TokenResponse = {
  access?: string;
  refresh?: string;
  detail?: string;
  error?: string;
};

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

export async function POST(request: Request) {
  const djangoApiUrl = process.env.DJANGO_API_URL;

  if (!djangoApiUrl) {
    return NextResponse.json(
      { ok: false, error: "Falta DJANGO_API_URL en el servidor." },
      { status: 500 },
    );
  }

  const body: unknown = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "El cuerpo de la solicitud debe ser JSON." },
      { status: 400 },
    );
  }

  const data = body as Record<string, unknown>;
  const username =
    typeof data.username === "string" ? data.username.trim() : "";
  const password =
    typeof data.password === "string" ? data.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { ok: false, error: "Usuario y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  let djangoResponse: Response;

  try {
    djangoResponse = await fetch(
      `${djangoApiUrl.replace(/\/+$/, "")}/auth/token/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo conectar con el servidor de Django.",
      },
      { status: 502 },
    );
  }

  const payload: TokenResponse | null = await djangoResponse
    .json()
    .catch(() => null);

  if (!djangoResponse.ok || !payload?.access || !payload?.refresh) {
    const status = djangoResponse.status === 401 ? 401 : 502;

    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(
          payload,
          "Usuario o contraseña incorrectos.",
        ),
      },
      { status },
    );
  }

  const secure = process.env.NODE_ENV === "production";
  const accessCookieName =
    process.env.JWT_ACCESS_COOKIE_NAME ?? "erp_access";
  const refreshCookieName =
    process.env.JWT_REFRESH_COOKIE_NAME ?? "erp_refresh";

  const response = NextResponse.json({
    ok: true,
    data: { authenticated: true },
  });

  response.cookies.set(accessCookieName, payload.access, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  response.cookies.set(refreshCookieName, payload.refresh, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

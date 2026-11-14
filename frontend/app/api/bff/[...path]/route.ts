import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearedCookieOptions,
} from "@/lib/authCookies";
import { isTokenExpired, refreshAccessToken } from "@/lib/authTokens";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type AccessResult =
  | { status: "ok"; token: string; refreshed: boolean }
  | { status: "unauthorized"; invalidRefresh: boolean };

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "cookie",
  "host",
  "authorization",
]);

async function resolveAccessToken(
  request: NextRequest,
): Promise<AccessResult> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;

  if (accessToken && !isTokenExpired(accessToken)) {
    return { status: "ok", token: accessToken, refreshed: false };
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return { status: "unauthorized", invalidRefresh: false };
  }

  const outcome = await refreshAccessToken(refreshToken);

  if (outcome.status !== "ok") {
    return {
      status: "unauthorized",
      invalidRefresh: outcome.status === "invalid",
    };
  }

  return { status: "ok", token: outcome.access, refreshed: true };
}

function unauthorized(invalidRefresh: boolean): NextResponse {
  const response = NextResponse.json(
    { ok: false, error: "No autenticado." },
    { status: 401 },
  );

  if (invalidRefresh) {
    response.cookies.set(REFRESH_COOKIE, "", clearedCookieOptions());
  }

  return response;
}

async function forwardRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const djangoApiUrl = process.env.DJANGO_API_URL;

  if (!djangoApiUrl) {
    return NextResponse.json(
      { ok: false, error: "Falta DJANGO_API_URL en el servidor." },
      { status: 500 },
    );
  }

  const access = await resolveAccessToken(request);

  if (access.status === "unauthorized") {
    return unauthorized(access.invalidRefresh);
  }

  const { path } = await context.params;

  if (path.some((segment) => !segment || segment === "." || segment === "..")) {
    return NextResponse.json(
      { ok: false, error: "Ruta inválida." },
      { status: 400 },
    );
  }

  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set("Authorization", `Bearer ${access.token}`);
  headers.set("Accept", "application/json");

  const baseUrl = djangoApiUrl.replace(/\/+$/, "");
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const targetUrl = new URL(`${baseUrl}/${encodedPath}/${request.nextUrl.search}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let djangoResponse: Response;

  try {
    djangoResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "follow",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo conectar con el servidor de Django." },
      { status: 502 },
    );
  }

  if (djangoResponse.status === 204) {
    const response = new NextResponse(null, { status: 204 });

    if (access.refreshed) {
      response.cookies.set(
        ACCESS_COOKIE,
        access.token,
        accessCookieOptions(),
      );
    }

    return response;
  }

  const responseBody = await djangoResponse.arrayBuffer();
  const responseHeaders = new Headers();
  const contentType =
    djangoResponse.headers.get("content-type") ?? "application/json";

  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Cache-Control", "no-store");

  const contentDisposition =
    djangoResponse.headers.get("content-disposition");

  if (contentDisposition) {
    responseHeaders.set("Content-Disposition", contentDisposition);
  }

  const response = new NextResponse(responseBody, {
    status: djangoResponse.status,
    headers: responseHeaders,
  });

  if (access.refreshed) {
    response.cookies.set(ACCESS_COOKIE, access.token, accessCookieOptions());
  }

  return response;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return forwardRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return forwardRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return forwardRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return forwardRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return forwardRequest(request, context);
}

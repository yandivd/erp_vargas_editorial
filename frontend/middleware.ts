import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearedCookieOptions,
} from "@/lib/authCookies";
import { isTokenExpired, refreshAccessToken } from "@/lib/authTokens";

const PUBLIC_PREFIXES = ["/fidelidad/", "/api/"];

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/catalogo" ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function loginRedirect(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;

  if (accessToken && !isTokenExpired(accessToken)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    const outcome = await refreshAccessToken(refreshToken);

    if (outcome.status === "ok") {
      request.cookies.set(ACCESS_COOKIE, outcome.access);

      const response = NextResponse.next({
        request: { headers: request.headers },
      });

      response.cookies.set(
        ACCESS_COOKIE,
        outcome.access,
        accessCookieOptions(),
      );

      return response;
    }

    if (outcome.status === "invalid") {
      const response = loginRedirect(request);
      response.cookies.set(REFRESH_COOKIE, "", clearedCookieOptions());
      return response;
    }
  }

  return loginRedirect(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

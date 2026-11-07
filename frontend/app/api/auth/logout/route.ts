import { NextResponse } from "next/server";

const ACCESS_COOKIE = process.env.JWT_ACCESS_COOKIE_NAME ?? "erp_access";
const REFRESH_COOKIE = process.env.JWT_REFRESH_COOKIE_NAME ?? "erp_refresh";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(ACCESS_COOKIE, "", cookieOptions());
  response.cookies.set(REFRESH_COOKIE, "", cookieOptions());

  return response;
}

import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearedCookieOptions,
} from "@/lib/authCookies";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(ACCESS_COOKIE, "", clearedCookieOptions());
  response.cookies.set(REFRESH_COOKIE, "", clearedCookieOptions());

  return response;
}

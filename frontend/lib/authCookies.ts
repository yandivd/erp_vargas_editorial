export const ACCESS_COOKIE =
  process.env.JWT_ACCESS_COOKIE_NAME ?? "erp_access";
export const REFRESH_COOKIE =
  process.env.JWT_REFRESH_COOKIE_NAME ?? "erp_refresh";

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ACCESS_MAX_AGE =
  60 * positiveNumber(process.env.JWT_ACCESS_MINUTES, 15);
export const REFRESH_MAX_AGE =
  60 * 60 * 24 * positiveNumber(process.env.JWT_REFRESH_DAYS, 7);

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function accessCookieOptions() {
  return { ...BASE_OPTIONS, maxAge: ACCESS_MAX_AGE };
}

export function refreshCookieOptions() {
  return { ...BASE_OPTIONS, maxAge: REFRESH_MAX_AGE };
}

export function clearedCookieOptions() {
  return { ...BASE_OPTIONS, maxAge: 0 };
}

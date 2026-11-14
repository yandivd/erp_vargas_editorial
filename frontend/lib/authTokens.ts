export type RefreshOutcome =
  | { status: "ok"; access: string }
  | { status: "invalid" }
  | { status: "error" };

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function isTokenExpired(token: string, leewayMs = 10_000): boolean {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return true;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as {
      exp?: unknown;
    };
    return (
      typeof payload.exp !== "number" ||
      payload.exp * 1000 <= Date.now() + leewayMs
    );
  } catch {
    return true;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshOutcome> {
  const baseUrl = process.env.DJANGO_API_URL;

  if (!baseUrl) {
    return { status: "error" };
  }

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/auth/refresh-access/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ refresh: refreshToken }),
        cache: "no-store",
      },
    );

    if (response.status === 400 || response.status === 401) {
      return { status: "invalid" };
    }

    if (!response.ok) {
      return { status: "error" };
    }

    const payload = (await response.json().catch(() => null)) as {
      access?: unknown;
    } | null;

    return typeof payload?.access === "string"
      ? { status: "ok", access: payload.access }
      : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

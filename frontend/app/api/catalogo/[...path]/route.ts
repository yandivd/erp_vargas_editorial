import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(
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

  const { path } = await context.params;
  const baseUrl = djangoApiUrl.replace(/\/+$/, "");
  const targetUrl = new URL(
    `${baseUrl}/catalogo/${path.map(encodeURIComponent).join("/")}/`,
  );

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers = new Headers({ Accept: "application/json" });

  if (process.env.VERCEL_BYPASS_SECRET) {
    headers.set(
      "x-vercel-protection-bypass",
      process.env.VERCEL_BYPASS_SECRET,
    );
  }

  let response: Response;

  try {
    response = await fetch(targetUrl, {
      headers,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo conectar con el servidor de Django." },
      { status: 502 },
    );
  }

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

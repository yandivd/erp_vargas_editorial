import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const PARAMETROS_PERMITIDOS = ["page", "per_page", "q"];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const djangoApiUrl = process.env.DJANGO_API_URL;

  if (!djangoApiUrl) {
    return NextResponse.json(
      { ok: false, error: "Falta DJANGO_API_URL en el servidor." },
      { status: 500 },
    );
  }

  const baseUrl = djangoApiUrl.replace(/\/+$/, "");
  const targetUrl = new URL(`${baseUrl}/catalogo/`);

  PARAMETROS_PERMITIDOS.forEach((parametro) => {
    const valor = request.nextUrl.searchParams.get(parametro);

    if (valor !== null && valor !== "") {
      targetUrl.searchParams.set(parametro, valor);
    }
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

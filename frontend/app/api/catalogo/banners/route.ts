import { NextResponse } from "next/server";

const DJANGO_API = (process.env.DJANGO_API_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

export async function GET() {
  try {
    const res = await fetch(`${DJANGO_API}/configuracion/banners/`, { cache: "no-store", headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? { ok: false, error: "Respuesta inválida" }, { status: res.status });
  } catch {
    return NextResponse.json({ ok: true, data: { banners: [] } });
  }
}

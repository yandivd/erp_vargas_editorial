import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { CatalogoDecoracion, CatalogoSeasonBanner } from "@/components/catalogos/CatalogoDecoracion";
import { normalizarTemaDecoracion } from "@/lib/decoracion";
import FidelidadCard from "@/components/fidelidad/FidelidadCard";
import { apiFetch } from "@/lib/api";
import type { FidelidadPublica } from "@/lib/fidelidad";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function FidelidadPublicaPage({ params }: PageProps) {
  const { token } = await params;

  const [result, tema] = await Promise.all([
    apiFetch<FidelidadPublica>(
      `fidelidad/publica/${encodeURIComponent(token)}`,
    )
      .then((fidelidad) => ({ ok: true as const, fidelidad }))
      .catch((error: unknown) => ({
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la tarjeta de fidelidad.",
      })),
    apiFetch<{ tema: string }>("configuracion/decoracion/")
      .then((d) => normalizarTemaDecoracion(d?.tema))
      .catch(() => "navidad" as const),
  ]);

  const bgImage = tema === "halloween"
    ? "radial-gradient(circle at top, rgba(251,146,60,0.14), transparent 35%), linear-gradient(to bottom, #0b0614 0%, #1a1025 55%, #09040f 100%)"
    : tema === "ninguno"
      ? "linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)"
      : "url('/img/navidad/stars.svg'), linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)";

  return (
    <main
      className="relative min-h-screen overflow-x-hidden bg-slate-950 px-4"
      style={{ backgroundImage: bgImage, backgroundRepeat: tema === "navidad" ? "repeat, no-repeat" : "no-repeat", backgroundSize: "cover" }}
    >
      <CatalogoDecoracion tema={tema} />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center pt-28 pb-16">
        {result.ok ? (
          <div className="w-full">
            <CatalogoSeasonBanner tema={tema} />
            <div className="mt-6">
              <FidelidadCard
                variant="public"
                nombre={result.fidelidad.cliente_nombre}
                sellos={result.fidelidad.sellos}
                meta={result.fidelidad.meta}
                bonoSaldo={result.fidelidad.bono_saldo}
                faltantes={result.fidelidad.faltantes}
              />
            </div>
            <p className="mt-5 text-center text-xs text-slate-300">
              Vargas Editorial ·{" "}
              <Link
                href="/catalogo"
                className="font-semibold text-amber-200 transition hover:text-amber-100"
              >
                Ver catálogo
              </Link>
            </p>
          </div>
        ) : (
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xl">
            <AlertTriangle
              className="mx-auto h-10 w-10 text-red-500"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-xl font-extrabold text-slate-900">
              Tarjeta no disponible
            </h1>
            <p className="mt-2 text-sm text-slate-600">{result.message}</p>
            <Link
              href="/catalogo"
              className="mt-5 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Ir al catálogo
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

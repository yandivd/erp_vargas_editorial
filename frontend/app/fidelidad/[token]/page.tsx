import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import Garland from "@/components/catalogos/Garland";
import SeasonBanner from "@/components/catalogos/SeasonBanner";
import Snowfall from "@/components/catalogos/Snowfall";
import FidelidadCard from "@/components/fidelidad/FidelidadCard";
import { apiFetch } from "@/lib/api";
import type { FidelidadPublica } from "@/lib/fidelidad";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function FidelidadPublicaPage({ params }: PageProps) {
  const { token } = await params;

  const result = await apiFetch<FidelidadPublica>(
    `fidelidad/publica/${encodeURIComponent(token)}`,
  )
    .then((fidelidad) => ({ ok: true as const, fidelidad }))
    .catch((error: unknown) => ({
      ok: false as const,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo cargar la tarjeta de fidelidad.",
    }));

  return (
    <main
      className="relative min-h-screen overflow-x-hidden bg-slate-950 px-4"
      style={{
        backgroundImage:
          "url('/img/navidad/stars.svg'), linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)",
        backgroundRepeat: "repeat, no-repeat",
        backgroundSize: "auto, cover",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-24 opacity-70 sm:block md:w-40 lg:w-56"
        style={{
          backgroundImage: "url('/img/navidad/pine-left.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 right-0 z-0 hidden w-24 opacity-70 sm:block md:w-40 lg:w-56"
        style={{
          backgroundImage: "url('/img/navidad/pine-right.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-24 w-full md:h-32"
        style={{
          backgroundImage: "url('/img/navidad/snow-bottom.svg')",
          backgroundSize: "100% 100%",
          backgroundPosition: "bottom",
          backgroundRepeat: "no-repeat",
        }}
      />
      <Snowfall />
      <Garland />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center pt-28 pb-16">
        {result.ok ? (
          <div className="w-full">
            <SeasonBanner />
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

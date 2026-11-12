import { AlertTriangle } from "lucide-react";
import Link from "next/link";
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
    `fidelidad/publica/${encodeURIComponent(token)}/`,
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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      {result.ok ? (
        <div className="w-full max-w-lg">
          <FidelidadCard
            variant="public"
            nombre={result.fidelidad.cliente_nombre}
            sellos={result.fidelidad.sellos}
            meta={result.fidelidad.meta}
            bonoSaldo={result.fidelidad.bono_saldo}
            faltantes={result.fidelidad.faltantes}
          />
          <p className="mt-5 text-center text-xs text-slate-500">
            Vargas Editorial ·{" "}
            <Link
              href="/catalogo"
              className="font-semibold text-brand hover:text-brand-dark"
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
    </main>
  );
}

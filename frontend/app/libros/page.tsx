import { AlertTriangle } from "lucide-react";
import LibrosClient from "@/components/libros/LibrosClient";
import { apiFetchEnvelope } from "@/lib/api";
import type { Libro } from "@/lib/libros";

export const dynamic = "force-dynamic";

export default async function LibrosPage() {
  const result = await apiFetchEnvelope<Libro[]>("libros")
    .then((envelope) => ({ data: envelope.data ?? [], error: null }))
    .catch((error: unknown) => ({ data: [] as Libro[], error: error instanceof Error ? error.message : "No se pudieron cargar los libros." }));

  if (result.error) {
    return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>No se pudieron cargar los libros.</strong><div>{result.error}</div></div></div>;
  }
  return <LibrosClient initialLibros={result.data} />;
}

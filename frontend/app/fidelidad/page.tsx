import { AlertTriangle } from "lucide-react";
import FidelidadClient from "@/components/fidelidad/FidelidadClient";
import { apiFetchEnvelope } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function FidelidadPage() {
  try {
    const all: any[] = [];
    let page = 1;
    while (page <= 20) {
      const envelope = await apiFetchEnvelope<any>(`clientes?per_page=200&page=${page}`);
      const clientes = envelope.data?.clientes ?? envelope.data ?? [];
      all.push(...(Array.isArray(clientes) ? clientes : []));
      if (!envelope.pagination?.has_next) break;
      page += 1;
    }
    return <FidelidadClient initialClientes={all} />;
  } catch (error) {
    return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>No se pudo cargar fidelidad.</strong><div>{error instanceof Error ? error.message : "Error inesperado"}</div></div></div>;
  }
}

import { AlertTriangle } from "lucide-react";
import FidelidadClient from "@/components/fidelidad/FidelidadClient";
import { apiFetchEnvelope } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function FidelidadPage() {
  try {
    const envelope = await apiFetchEnvelope<any>("clientes?all=1");
    const clientes = envelope.data?.clientes ?? envelope.data ?? [];
    return <FidelidadClient initialClientes={Array.isArray(clientes) ? clientes : []} />;
  } catch (error) {
    return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>No se pudo cargar fidelidad.</strong><div>{error instanceof Error ? error.message : "Error inesperado"}</div></div></div>;
  }
}

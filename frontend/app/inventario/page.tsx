import { AlertTriangle } from "lucide-react";
import InventarioClient from "@/components/inventario/InventarioClient";
import { apiFetchEnvelope } from "@/lib/api";
import type { InventarioMaterial } from "@/lib/inventario";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const result = await apiFetchEnvelope<{ materiales: InventarioMaterial[] }>("inventario?all=1")
    .then((envelope) => ({ data: envelope.data.materiales ?? [], error: null }))
    .catch((error: unknown) => ({ data: [] as InventarioMaterial[], error: error instanceof Error ? error.message : "No se pudieron cargar el inventario." }));
  if (result.error) return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>No se pudo cargar el inventario.</strong><div>{result.error}</div></div></div>;
  return <InventarioClient initialMateriales={result.data} />;
}

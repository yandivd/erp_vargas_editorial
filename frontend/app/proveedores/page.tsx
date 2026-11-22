import { AlertTriangle } from "lucide-react";
import ProveedoresClient from "@/components/proveedores/ProveedoresClient";
import { apiFetchEnvelope } from "@/lib/api";
import type { Proveedor } from "@/lib/proveedores";

export const dynamic = "force-dynamic";
type ProveedoresData = { proveedores: Proveedor[] };

export default async function ProveedoresPage() {
  const result = await apiFetchEnvelope<ProveedoresData>("proveedores?per_page=500")
    .then((envelope) => ({ data: envelope.data.proveedores ?? [], error: null }))
    .catch((error: unknown) => ({ data: [] as Proveedor[], error: error instanceof Error ? error.message : "No se pudieron cargar los proveedores." }));
  if (result.error) return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>No se pudieron cargar los proveedores.</strong><div>{result.error}</div></div></div>;
  return <ProveedoresClient initialProveedores={result.data} />;
}

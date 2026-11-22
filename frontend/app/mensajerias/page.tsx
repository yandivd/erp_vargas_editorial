import { AlertTriangle } from "lucide-react";
import MensajeriasClient from "@/components/mensajerias/MensajeriasClient";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";
type Tarifa = { provincia: string; municipio: string; costo: number };

export default async function MensajeriasPage() {
  let tarifas: Tarifa[] = []; let error: string | null = null;
  try { const data = await apiFetch<{ tarifas: Tarifa[] }>("configuracion/mensajeria/"); tarifas = data.tarifas ?? []; }
  catch (e) { error = e instanceof Error ? e.message : "No se pudieron cargar las tarifas."; }
  if (error) return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>No se pudieron cargar las tarifas.</strong><div>{error}</div></div></div>;
  return <MensajeriasClient initialTarifas={tarifas} />;
}

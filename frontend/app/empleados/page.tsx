import { AlertTriangle } from "lucide-react";
import EmpleadosClient from "@/components/empleados/EmpleadosClient";
import { apiFetch, apiFetchEnvelope } from "@/lib/api";
import type { Empleado, EmpleadosData, UtilidadesDisponibles } from "@/lib/empleados";

export const dynamic = "force-dynamic";

export default async function EmpleadosPage() {
  const [empleadosResult, utilidadesResult] = await Promise.all([
    apiFetchEnvelope<EmpleadosData>("empleados?per_page=500")
      .then((envelope) => ({ data: envelope.data.empleados ?? [], error: null as string | null }))
      .catch((error: unknown) => ({ data: [] as Empleado[], error: error instanceof Error ? error.message : "No se pudieron cargar los empleados." })),
    apiFetch<UtilidadesDisponibles>("empleados/utilidades-disponibles")
      .then((data) => ({ data, error: null as string | null }))
      .catch((error: unknown) => ({ data: null, error: error instanceof Error ? error.message : "No se pudieron calcular las utilidades disponibles." })),
  ]);

  if (empleadosResult.error && !empleadosResult.data.length) {
    return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>No se pudieron cargar los empleados.</strong><div>{empleadosResult.error}</div></div></div>;
  }
  return <EmpleadosClient initialEmpleados={empleadosResult.data} utilidades={utilidadesResult.data} utilidadesError={utilidadesResult.error} />;
}

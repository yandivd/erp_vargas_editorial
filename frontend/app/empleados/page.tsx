import { AlertTriangle, SearchX, UserRound } from "lucide-react";
import EmpleadosTable from "@/components/empleados/EmpleadosTable";
import NuevoEmpleadoModal from "@/components/empleados/NuevoEmpleadoModal";
import PagoEmpleadoButton from "@/components/empleados/PagoEmpleadoButton";
import UtilidadesWidget from "@/components/empleados/UtilidadesWidget";
import { apiFetch, apiFetchEnvelope } from "@/lib/api";
import type {
  Empleado,
  EmpleadosData,
  UtilidadesDisponibles,
} from "@/lib/empleados";

export const dynamic = "force-dynamic";

type Carga<T> = { data: T; error: null } | { data: null; error: string };

async function cargarDatos<T>(
  promesa: Promise<T>,
  mensaje: string,
): Promise<Carga<T>> {
  try {
    return { data: await promesa, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : mensaje,
    };
  }
}

export default async function EmpleadosPage() {
  const [empleadosResult, utilidadesResult] = await Promise.all([
    apiFetchEnvelope<EmpleadosData>("empleados/?per_page=500")
      .then((envelope) => ({
        data: envelope.data.empleados ?? [],
        error: null,
      }))
      .catch((error: unknown) => ({
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los empleados.",
      })),
    cargarDatos(
      apiFetch<UtilidadesDisponibles>("empleados/utilidades-disponibles/"),
      "No se pudieron calcular las utilidades disponibles.",
    ),
  ]);

  const empleados: Empleado[] = empleadosResult.data ?? [];
  const utilidades = utilidadesResult.data;
  const tasaActual = utilidades?.tasa_actual ?? 0;

  return (
    <div>
      <PageHeader empleados={empleados} tasaActual={tasaActual} />

      {empleadosResult.error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <strong>No se pudieron cargar los empleados.</strong>
            <div>{empleadosResult.error}</div>
          </div>
        </div>
      ) : (
        <>
          {utilidades ? (
            <UtilidadesWidget data={utilidades} />
          ) : (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                No se pudieron calcular las utilidades disponibles
                {utilidadesResult.error ? `: ${utilidadesResult.error}` : "."}
              </span>
            </div>
          )}

          <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
            {empleados.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
                <SearchX
                  className="mb-3 h-10 w-10 text-slate-300"
                  aria-hidden="true"
                />
                <p className="font-semibold text-ink">No hay empleados</p>
                <p className="mt-1 text-sm">
                  Registra un empleado para comenzar a controlar la nómina.
                </p>
              </div>
            ) : (
              <EmpleadosTable
                empleados={empleados}
                tasaActual={tasaActual}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PageHeader({
  empleados,
  tasaActual,
}: {
  empleados: Empleado[];
  tasaActual: number;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
          <UserRound className="h-7 w-7 text-brand" aria-hidden="true" />
          Nómina
        </h1>
        <p className="mt-1 text-sm text-muted">
          Empleados, salarios, historial de pagos y retiro de utilidades.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {empleados.length > 0 ? (
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
            <span className="font-bold text-ink">{empleados.length}</span>{" "}
            empleado{empleados.length === 1 ? "" : "s"}
          </div>
        ) : null}
        <PagoEmpleadoButton
          empleados={empleados}
          tasaActual={tasaActual}
        />
        <NuevoEmpleadoModal />
      </div>
    </div>
  );
}

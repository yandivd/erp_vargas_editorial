import { AlertTriangle, SearchX, Truck } from "lucide-react";
import NuevoProveedorModal from "@/components/proveedores/NuevoProveedorModal";
import ProveedoresTable from "@/components/proveedores/ProveedoresTable";
import { apiFetchEnvelope } from "@/lib/api";
import type { Proveedor } from "@/lib/proveedores";

export const dynamic = "force-dynamic";

type ProveedoresData = {
  proveedores: Proveedor[];
};

export default async function ProveedoresPage() {
  const result = await apiFetchEnvelope<ProveedoresData>(
    "proveedores/?per_page=500",
  )
    .then((envelope) => ({ envelope, error: null }))
    .catch((error: unknown) => ({
      envelope: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los proveedores.",
    }));

  if (result.error || !result.envelope) {
    return (
      <div>
        <PageHeader />
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar los proveedores.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const proveedores = result.envelope.data.proveedores ?? [];

  return (
    <div>
      <PageHeader count={proveedores.length} />

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        {proveedores.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
            <SearchX className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-ink">No hay proveedores</p>
            <p className="mt-1 text-sm">
              Registra un proveedor para comenzar a agrupar servicios externos.
            </p>
          </div>
        ) : (
          <ProveedoresTable proveedores={proveedores} />
        )}
      </section>
    </div>
  );
}

function PageHeader({ count }: { count?: number }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
          <Truck className="h-7 w-7 text-brand" aria-hidden="true" />
          Proveedores
        </h1>
        <p className="mt-1 text-sm text-muted">
          Directorio de proveedores, deudas y lotes de servicios externos.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {typeof count === "number" ? (
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
            <span className="font-bold text-ink">{count}</span>{" "}
            proveedor{count === 1 ? "" : "es"}
          </div>
        ) : null}
        <NuevoProveedorModal />
      </div>
    </div>
  );
}

import {
  AlertTriangle,
  ArrowLeft,
  MapPin,
  Phone,
  Truck,
} from "lucide-react";
import Link from "next/link";
import LotesPanel from "@/components/proveedores/LotesPanel";
import { apiFetch } from "@/lib/api";
import type { ProveedorLotesData } from "@/lib/proveedores";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProveedorLotesPage({ params }: PageProps) {
  const { id } = await params;
  const result = await apiFetch<ProveedorLotesData>(
    `proveedores/${encodeURIComponent(id)}/lotes/`,
  )
    .then((data) => ({ data, error: null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los lotes del proveedor.",
    }));

  if (result.error || !result.data) {
    return (
      <div>
        <Link
          href="/proveedores"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a proveedores
        </Link>
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar los lotes.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const { proveedor, abiertos, pagados } = result.data;

  return (
    <div>
      <Link
        href="/proveedores"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a proveedores
      </Link>

      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <Truck className="h-7 w-7 text-brand" aria-hidden="true" />
            {proveedor.nombre}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="font-semibold text-ink">
              {proveedor.tipo_label}
            </span>
            {proveedor.telefono ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {proveedor.telefono}
              </span>
            ) : null}
            {proveedor.direccion ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {proveedor.direccion}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <LotesPanel
        proveedor={proveedor}
        abiertos={abiertos}
        pagados={pagados}
      />
    </div>
  );
}

import { AlertTriangle, Package, SearchX } from "lucide-react";
import HistorialModal from "@/components/inventario/HistorialModal";
import MovimientoModal from "@/components/inventario/MovimientoModal";
import SalidaRapidaModal from "@/components/inventario/SalidaRapidaModal";
import InventarioFilters from "@/components/inventario/InventarioFilters";
import {
  apiFetchEnvelope,
  type ApiPagination,
} from "@/lib/api";
import { number } from "@/lib/format";
import type { InventarioMaterial } from "@/lib/inventario";
import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
};

export default async function InventarioPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const parsedPage = Number(params.page ?? "1");
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const query = new URLSearchParams();
  query.set("page", String(page));
  query.set("per_page", "20");
  if (search) {
    query.set("search", search);
  }

  const result = await apiFetchEnvelope<{
    materiales: InventarioMaterial[];
  }>(
    `inventario/?${query.toString()}`,
  )
    .then((envelope) => ({ envelope, error: null }))
    .catch((error: unknown) => ({
      envelope: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar el inventario.",
    }));

  if (result.error || !result.envelope) {
    return (
      <div>
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el inventario.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const materiales = result.envelope.data.materiales ?? [];
  const pagination = result.envelope.pagination as
    | ApiPagination
    | null
    | undefined;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <Package className="h-7 w-7 text-brand" aria-hidden="true" />
            Inventario
          </h1>
          <p className="mt-1 text-sm text-muted">
            Control de materiales, stocks y alertas de reposición.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {typeof pagination?.count === "number" ? (
            <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
              <span className="font-bold text-ink">{pagination.count}</span>{" "}
              material{pagination.count === 1 ? "" : "es"}
            </div>
          ) : null}
          <MovimientoModal materiales={materiales} />
        </div>
      </div>

      <InventarioFilters initialSearch={search} />

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        {materiales.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
            <SearchX className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-ink">No encontramos materiales</p>
            <p className="mt-1 text-sm">
              Ajusta la búsqueda o registra un nuevo movimiento.
            </p>
          </div>
        ) : (
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Material</th>
                  <th className={thClass}>Unidad</th>
                  <th className={`${thClass} text-right`}>Stock Actual</th>
                  <th className={`${thClass} text-right`}>Stock Mínimo</th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {materiales.map((material) => {
                  const stockBajo = Boolean(material.stock_bajo);

                  return (
                    <tr key={material.id} className={tableRowClass}>
                      <td className={tdClass}>{material.nombre}</td>
                      <td className={tdClass}>{material.unidad_medida}</td>
                      <td className={`${tdClass} text-right`}>
                        {number(material.stock_actual)}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        {number(material.stock_minimo)}
                      </td>
                      <td className={tdClass}>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            stockBajo
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {stockBajo ? "Stock bajo" : "OK"}
                        </span>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="flex flex-wrap justify-end gap-2">
                          <SalidaRapidaModal material={material} />
                          <HistorialModal material={material} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

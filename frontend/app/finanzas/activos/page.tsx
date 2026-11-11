import { AlertTriangle, ChevronRight, HardDrive } from "lucide-react";
import Link from "next/link";
import {
  EmptyTableRow,
  KpiCard,
  SectionCard,
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { apiFetchEnvelope } from "@/lib/api";
import type { ActivosData } from "@/lib/activos";
import { formatDate, integer, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ActivosPage() {
  const result = await apiFetchEnvelope<ActivosData>("finanzas/activos/")
    .then((envelope) => ({ data: envelope.data, error: null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los activos fijos.",
    }));

  const activos = result.data?.activos ?? [];
  const resumen = result.data?.resumen;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <HardDrive className="h-7 w-7 text-brand" aria-hidden="true" />
            Activos fijos
          </h1>
          <p className="mt-1 text-sm text-muted">
            Costo, depreciación acumulada y valor en libros calculados al día.
          </p>
        </div>
        {resumen ? (
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
            <span className="font-bold text-ink">{resumen.cantidad}</span>{" "}
            activo{resumen.cantidad === 1 ? "" : "s"} ·{" "}
            <span className="font-bold text-ink">
              {resumen.cantidad_activos}
            </span>{" "}
            en uso
          </div>
        ) : null}
      </div>

      {result.error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar los activos fijos.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Activos registrados"
              value={integer(resumen?.cantidad ?? 0)}
              sub={`${integer(resumen?.cantidad_activos ?? 0)} activos en uso`}
              tone="blue"
            />
            <KpiCard
              label="Costo de adquisición"
              value={money(resumen?.total_valor_compra ?? 0)}
              sub="Valor original de los activos"
              tone="violet"
            />
            <KpiCard
              label="Depreciación acumulada"
              value={money(resumen?.total_depreciacion_acumulada ?? 0)}
              sub={`Mensual: ${money(resumen?.total_depreciacion_mensual ?? 0)}`}
              tone="amber"
            />
            <KpiCard
              label="Valor en libros"
              value={money(resumen?.total_valor_en_libros ?? 0)}
              sub="Costo menos depreciación"
              tone="emerald"
            />
          </div>

          <SectionCard
            title="Listado de activos"
            icon={<HardDrive className="h-5 w-5 text-brand" aria-hidden="true" />}
          >
            <div className={tableWrapClass}>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Nombre</th>
                    <th className={`${thClass} text-right`}>Costo</th>
                    <th className={`${thClass} text-right`}>
                      Depreciación acumulada
                    </th>
                    <th className={`${thClass} text-right`}>Valor en libros</th>
                    <th className={thClass}>Estado</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody>
                  {activos.length ? (
                    activos.map((activo) => (
                      <tr key={activo.id} className={tableRowClass}>
                        <td className={tdClass}>
                          <Link
                            href={`/finanzas/activos/${activo.id}`}
                            className="font-semibold text-ink transition hover:text-brand"
                          >
                            {activo.nombre}
                          </Link>
                          <div className="text-xs text-muted">
                            Compra: {formatDate(activo.fecha_compra)} · Vida útil:{" "}
                            {integer(activo.vida_util_meses)} meses
                          </div>
                        </td>
                        <td className={`${tdClass} text-right`}>
                          {money(activo.valor_compra)}
                        </td>
                        <td className={`${tdClass} text-right text-red-600`}>
                          {money(activo.depreciacion_acumulada)}
                        </td>
                        <td
                          className={`${tdClass} text-right font-semibold text-emerald-700`}
                        >
                          {money(activo.valor_en_libros)}
                        </td>
                        <td className={tdClass}>
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                              activo.activo
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {activo.estado_label}
                          </span>
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <Link
                            href={`/finanzas/activos/${activo.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand"
                          >
                            Detalle
                            <ChevronRight
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyTableRow colSpan={6}>
                      No hay activos registrados. Créalos desde el administrador.
                    </EmptyTableRow>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

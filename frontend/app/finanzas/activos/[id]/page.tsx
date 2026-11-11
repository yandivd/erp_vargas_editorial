import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  HardDrive,
} from "lucide-react";
import Link from "next/link";
import { KpiCard, SectionCard } from "@/components/dashboard/ui";
import { apiFetch } from "@/lib/api";
import type { ActivoFijo } from "@/lib/activos";
import { formatDate, integer, money } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ActivoDetallePage({ params }: PageProps) {
  const { id } = await params;
  const result = await apiFetch<ActivoFijo>(`finanzas/activos/${id}/`)
    .then((activo) => ({ activo, error: null }))
    .catch((error: unknown) => ({
      activo: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cargar el activo fijo.",
    }));

  const activo = result.activo;
  const porcentajeDepreciado = activo?.total_depreciable
    ? Math.min(
        100,
        (activo.depreciacion_acumulada / activo.total_depreciable) * 100,
      )
    : 0;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/finanzas/activos"
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a activos fijos
          </Link>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <HardDrive className="h-7 w-7 text-brand" aria-hidden="true" />
            {activo?.nombre ?? "Activo fijo"}
          </h1>
          {activo ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Comprado el {formatDate(activo.fecha_compra)}
            </p>
          ) : null}
        </div>
        {activo ? (
          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
              activo.activo
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {activo.estado_label}
          </span>
        ) : null}
      </div>

      {result.error || !activo ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el activo fijo.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Costo de adquisición"
              value={money(activo.valor_compra)}
              sub={`Residual: ${money(activo.valor_residual)}`}
              tone="violet"
            />
            <KpiCard
              label="Depreciación mensual"
              value={money(activo.depreciacion_mensual)}
              sub={`${integer(activo.meses_transcurridos)} meses transcurridos`}
              tone="amber"
            />
            <KpiCard
              label="Depreciación acumulada"
              value={money(activo.depreciacion_acumulada)}
              sub={`${porcentajeDepreciado.toFixed(1)}% del total depreciable`}
              tone="red"
            />
            <KpiCard
              label="Valor en libros"
              value={money(activo.valor_en_libros)}
              sub="Valor actual del activo"
              tone="emerald"
            />
          </div>

          <SectionCard
            title="Desglose de depreciación"
            icon={<HardDrive className="h-5 w-5 text-brand" aria-hidden="true" />}
          >
            <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${porcentajeDepreciado}%` }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Dato
                label="Depreciación mensual"
                value={money(activo.depreciacion_mensual)}
              />
              <Dato
                label="Meses transcurridos"
                value={`${integer(activo.meses_transcurridos)} meses`}
              />
              <Dato
                label="Depreciación acumulada"
                value={money(activo.depreciacion_acumulada)}
              />
              <Dato
                label="Valor actual"
                value={money(activo.valor_en_libros)}
              />
              <Dato label="Costo de adquisición" value={money(activo.valor_compra)} />
              <Dato label="Valor residual" value={money(activo.valor_residual)} />
              <Dato
                label="Total depreciable"
                value={money(activo.total_depreciable)}
              />
              <Dato
                label="Vida útil"
                value={`${integer(activo.vida_util_meses)} meses`}
              />
            </div>

            <p className="mt-5 rounded-lg border border-line bg-slate-50 px-4 py-3 text-xs text-muted">
              Depreciación acumulada = depreciación mensual × meses
              transcurridos, limitada al valor de adquisición menos el valor
              residual. Este cálculo es contable y no genera movimientos de
              caja.
            </p>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-ink">{value}</div>
    </div>
  );
}

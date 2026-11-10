import {
  AlertTriangle,
  ArrowRightLeft,
  History,
  SearchX,
} from "lucide-react";
import CajaTable from "@/components/finanzas/CajaTable";
import DivisaModal from "@/components/finanzas/DivisaModal";
import { KpiCard, SectionCard } from "@/components/dashboard/ui";
import { apiFetch, apiFetchEnvelope } from "@/lib/api";
import {
  moneyCaja,
  type CajaData,
  type CajaResumen,
} from "@/lib/finanzas";

export const dynamic = "force-dynamic";

export default async function FinanzasDivisasPage() {
  const [resumenResult, movimientosResult] = await Promise.all([
    apiFetch<CajaResumen>("finanzas/caja/resumen/")
      .then((resumen) => ({ resumen, error: null }))
      .catch((error: unknown) => ({
        resumen: null,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el resumen de caja.",
      })),
    apiFetchEnvelope<CajaData>("finanzas/caja/?per_page=50")
      .then((envelope) => ({
        movimientos: envelope.data.movimientos,
        error: null,
      }))
      .catch((error: unknown) => ({
        movimientos: [],
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los movimientos de caja.",
      })),
  ]);

  const movimientosDivisas = movimientosResult.movimientos.filter(
    (movimiento) =>
      movimiento.categoria === "COMPRA_DIVISA" ||
      movimiento.categoria === "VENTA_DIVISA",
  );
  const saldoCup = resumenResult.resumen?.saldo_actual_cup ?? 0;
  const saldoUsd = resumenResult.resumen?.saldo_actual_usd ?? 0;
  const tasaSistema = resumenResult.resumen?.tasa_usd ?? 0;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <ArrowRightLeft
              className="h-7 w-7 text-brand"
              aria-hidden="true"
            />
            Divisas (USD)
          </h1>
          <p className="mt-1 text-sm text-muted">
            Compras y ventas de divisas.
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          label="Saldo CUP"
          value={
            resumenResult.resumen
              ? moneyCaja(saldoCup, "CUP")
              : "—"
          }
          sub="Disponible en caja"
          tone="blue"
        />
        <KpiCard
          label="Saldo USD"
          value={
            resumenResult.resumen
              ? moneyCaja(saldoUsd, "USD")
              : "—"
          }
          sub="Disponible en caja"
          tone="cyan"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DivisaModal modo="compra" saldoUsd={saldoUsd} tasaSistema={tasaSistema} />
        <DivisaModal modo="venta" saldoUsd={saldoUsd} tasaSistema={tasaSistema} />
      </div>

      {movimientosResult.error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <strong>No se pudieron cargar los movimientos de caja.</strong>
            <div>{movimientosResult.error}</div>
          </div>
        </div>
      ) : (
        <SectionCard
          title="Historial de divisas"
          icon={
            <History
              className="h-5 w-5 text-emerald-600"
              aria-hidden="true"
            />
          }
        >
          {movimientosDivisas.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
              <SearchX
                className="mb-3 h-10 w-10 text-slate-300"
                aria-hidden="true"
              />
              <p className="font-semibold text-ink">No hay operaciones de divisas</p>
              <p className="mt-1 text-sm">
                Registra una compra o venta para ver el historial.
              </p>
            </div>
          ) : (
            <CajaTable movimientos={movimientosDivisas} />
          )}
        </SectionCard>
      )}
    </div>
  );
}

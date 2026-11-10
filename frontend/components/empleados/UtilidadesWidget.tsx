import { PiggyBank, Wallet } from "lucide-react";
import { money, number } from "@/lib/format";
import type { UtilidadesDisponibles } from "@/lib/empleados";

export default function UtilidadesWidget({
  data,
}: {
  data: UtilidadesDisponibles;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-ink">
            <PiggyBank className="h-6 w-6 text-emerald-600" aria-hidden="true" />
            Utilidades disponibles
          </h2>
          <p className="mt-1 text-sm text-muted">
            CUP: caja menos pasivos operativos. USD: efectivo físico en caja.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 text-center shadow-sm">
          <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
            Máximos disponibles
          </div>
          <div className="mt-1 text-lg font-extrabold text-emerald-700">
            CUP: {money(data.disponible_cup)}
          </div>
          <div className="text-lg font-extrabold text-sky-700">
            USD: {money(data.disponible_usd, "USD")}
          </div>
          <div className="mt-1 text-xs text-muted">
            Tasa: {number(data.tasa_actual)} CUP/USD
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-white px-3 py-2">
          <div className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            Saldo CUP
          </div>
          <div className="mt-0.5 font-bold text-ink">
            {money(data.saldo_cup)}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white px-3 py-2">
          <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
            Saldo USD
          </div>
          <div className="mt-0.5 font-bold text-ink">
            {money(data.saldo_usd, "USD")}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white px-3 py-2">
          <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
            Anticipos
          </div>
          <div className="mt-0.5 font-bold text-ink">
            {money(data.anticipos)}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white px-3 py-2">
          <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
            Deudas
          </div>
          <div className="mt-0.5 font-bold text-ink">
            {money(data.deudas)}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">{data.mensaje}</p>
    </section>
  );
}

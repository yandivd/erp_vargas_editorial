import { Check, Gift, Sparkles, Stamp } from "lucide-react";
import Link from "next/link";
import { money } from "@/lib/format";

type FidelidadCardProps = {
  nombre?: string;
  sellos: number;
  meta: number;
  bonoSaldo: number;
  faltantes?: number;
  publicHref?: string;
  variant?: "panel" | "public";
};

export default function FidelidadCard({
  nombre,
  sellos,
  meta,
  bonoSaldo,
  faltantes,
  publicHref,
  variant = "panel",
}: FidelidadCardProps) {
  const sellosSeguros = Math.max(0, Math.min(meta, Math.round(sellos)));
  const restantes =
    typeof faltantes === "number"
      ? Math.max(0, faltantes)
      : Math.max(0, meta - sellosSeguros);
  const completo = sellosSeguros >= meta;
  const porcentaje = meta > 0 ? Math.min(100, (sellosSeguros / meta) * 100) : 0;
  const tieneBono = bonoSaldo > 0;

  const stampCells = Array.from({ length: meta }, (_, index) => {
    const marcado = index < sellosSeguros;
    return (
      <div
        key={index}
        className={`flex aspect-square items-center justify-center rounded-full border-2 transition ${
          marcado
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-dashed border-slate-300 bg-slate-50 text-slate-400"
        }`}
        aria-label={`Sello ${index + 1}${marcado ? " completado" : " pendiente"}`}
      >
        {marcado ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <span className="text-xs font-bold">{index + 1}</span>
        )}
      </div>
    );
  });

  if (variant === "public") {
    return (
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 px-6 py-7 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[2px] text-blue-200">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Tarjeta de fidelidad
          </div>
          <h1 className="mt-3 text-2xl font-extrabold">
            {nombre || "Cliente Vargas Editorial"}
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Acumula 10 sellos y recibe un bono de {money(5000)} para tu próxima
            compra.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">
                Sellos acumulados
              </div>
              <div className="mt-1 text-4xl font-extrabold text-slate-900">
                {sellosSeguros}
                <span className="text-lg font-semibold text-slate-400">
                  /{meta}
                </span>
              </div>
            </div>
            <div
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                completo
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {completo
                ? "¡Tarjeta completa!"
                : `Faltan ${restantes} sello${restantes === 1 ? "" : "s"}`}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2.5">{stampCells}</div>

          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${porcentaje}%` }}
            />
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              tieneBono
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Gift className="h-4 w-4" aria-hidden="true" />
              {tieneBono ? "Bono disponible" : "Bono de fidelidad"}
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">
              {money(bonoSaldo)}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {tieneBono
                ? "Puedes usar este saldo como descuento en tu próximo pedido."
                : "Completa los 10 sellos para recibir $5,000.00 de descuento."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Stamp className="h-4 w-4 text-brand" aria-hidden="true" />
            {sellosSeguros} de {meta} sellos
          </div>
          <p className="mt-1 text-sm text-muted">
            {completo
              ? "Tarjeta completa. El bono está disponible para el próximo pedido."
              : `Faltan ${restantes} sello${restantes === 1 ? "" : "s"} para obtener el bono.`}
          </p>
        </div>
        <div
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
            tieneBono
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Gift className="h-4 w-4" aria-hidden="true" />
          Bono: {money(bonoSaldo)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {stampCells}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:max-w-sm">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        {publicHref ? (
          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand transition hover:text-brand-dark"
          >
            Ver tarjeta pública
          </Link>
        ) : null}
      </div>
    </div>
  );
}

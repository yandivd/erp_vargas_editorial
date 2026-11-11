import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import PrintButton from "@/components/inventario/PrintButton";
import { apiFetch } from "@/lib/api";
import { moneyCaja, type CierreCaja } from "@/lib/finanzas";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function diferenciaTexto(value: number, moneda: "CUP" | "USD"): string {
  if (value === 0) {
    return "Cuadró";
  }

  return `${value > 0 ? "+" : "−"}${moneyCaja(Math.abs(value), moneda)}`;
}

function diferenciaClase(value: number): string {
  if (value === 0) {
    return "text-emerald-700";
  }

  return value > 0 ? "text-amber-700" : "text-red-700";
}

export default async function ArqueoPdfPage({ params }: PageProps) {
  const { id } = await params;
  const result = await apiFetch<CierreCaja>(
    `finanzas/arqueos/${encodeURIComponent(id)}/`,
  )
    .then((data) => ({ data, error: null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cargar el arqueo.",
    }));

  if (result.error || !result.data) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white">
        <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el arqueo.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const arqueo = result.data;
  const hayDiferencia =
    arqueo.diferencia_cup !== 0 || arqueo.diferencia_usd !== 0;
  const cantidades = Object.entries(arqueo.cantidades ?? {})
    .map(([denominacion, cantidad]) => ({
      denominacion: Number(denominacion),
      cantidad: Number(cantidad),
    }))
    .filter(
      ({ denominacion, cantidad }) =>
        Number.isFinite(denominacion) && cantidad > 0,
    )
    .sort((a, b) => b.denominacion - a.denominacion);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:min-h-0 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4;
          margin: 18mm;
        }
        @media print {
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between print:hidden">
        <Link
          href="/finanzas/arqueos"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al historial
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-3xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              Vargas ERP
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-wide text-slate-900">
              ARQUEO DE CAJA
            </h1>
            <p className="mt-1 text-sm text-muted">
              Cierre y conciliación de efectivo
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-slate-900">
              No. {String(arqueo.id).padStart(6, "0")}
            </p>
            <p className="mt-1 text-muted">{formatDateTime(arqueo.fecha)}</p>
            <p className="mt-1 text-muted">{arqueo.usuario || "—"}</p>
          </div>
        </header>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b-2 border-slate-900 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted">
                Moneda
              </th>
              <th className="border-b-2 border-slate-900 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-muted">
                Saldo del sistema
              </th>
              <th className="border-b-2 border-slate-900 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-muted">
                Total contado
              </th>
              <th className="border-b-2 border-slate-900 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-muted">
                Diferencia
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-line px-2 py-3 font-bold text-slate-900">
                CUP
              </td>
              <td className="border-b border-line px-2 py-3 text-right">
                {moneyCaja(arqueo.saldo_esperado_cup, "CUP")}
              </td>
              <td className="border-b border-line px-2 py-3 text-right">
                {moneyCaja(arqueo.saldo_real_cup, "CUP")}
              </td>
              <td
                className={`border-b border-line px-2 py-3 text-right font-bold ${diferenciaClase(
                  arqueo.diferencia_cup,
                )}`}
              >
                {diferenciaTexto(arqueo.diferencia_cup, "CUP")}
              </td>
            </tr>
            <tr>
              <td className="border-b border-line px-2 py-3 font-bold text-slate-900">
                USD
              </td>
              <td className="border-b border-line px-2 py-3 text-right">
                {moneyCaja(arqueo.saldo_esperado_usd, "USD")}
              </td>
              <td className="border-b border-line px-2 py-3 text-right">
                {moneyCaja(arqueo.saldo_real_usd, "USD")}
              </td>
              <td
                className={`border-b border-line px-2 py-3 text-right font-bold ${diferenciaClase(
                  arqueo.diferencia_usd,
                )}`}
              >
                {diferenciaTexto(arqueo.diferencia_usd, "USD")}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm">
          <span className="text-muted">Transferencias / Tarjeta (CUP)</span>
          <span className="font-bold text-slate-900">
            {moneyCaja(arqueo.transferencia, "CUP")}
          </span>
        </div>

        <section className="mt-6">
          <h2 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Desglose de billetes contados
          </h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-line px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted">
                  Denominación
                </th>
                <th className="border-b border-line px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-muted">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {cantidades.length > 0 ? (
                cantidades.map(({ denominacion, cantidad }) => (
                  <tr key={denominacion}>
                    <td className="border-b border-line px-2 py-2 text-slate-900">
                      ${denominacion}
                    </td>
                    <td className="border-b border-line px-2 py-2 text-right text-slate-900">
                      {cantidad}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={2}
                    className="border-b border-line px-2 py-2 text-center text-muted"
                  >
                    Sin billetes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h2 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Resultado
          </h2>
          <p
            className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
              hayDiferencia
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {hayDiferencia
              ? "El arqueo presenta diferencias. Se registraron ajustes automáticos en la caja."
              : "El arqueo cuadra con el saldo del sistema en las monedas contadas."}
          </p>
        </section>

        <section className="mt-8">
          <h2 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Notas
          </h2>
          <p className="mt-3 min-h-[3rem] whitespace-pre-wrap text-sm text-slate-900">
            {arqueo.notas || "Sin observaciones."}
          </p>
        </section>

        <div className="mt-16 grid grid-cols-2 gap-12 text-sm">
          <div>
            <div className="border-t border-slate-900 pt-2 text-center text-muted">
              Firma del responsable
            </div>
          </div>
          <div>
            <div className="border-t border-slate-900 pt-2 text-center text-muted">
              Firma de autorización
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  SearchX,
} from "lucide-react";
import Link from "next/link";
import {
  apiFetchEnvelope,
  type ApiPagination,
} from "@/lib/api";
import {
  moneyCaja,
  type ArqueosData,
  type CierreCaja,
} from "@/lib/finanzas";
import { formatDateTime } from "@/lib/format";
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
    page?: string;
  }>;
};

function hrefForPage(page: number): string {
  return page > 1 ? `/finanzas/arqueos?page=${page}` : "/finanzas/arqueos";
}

function Diferencia({
  value,
  moneda,
}: {
  value: number;
  moneda: "CUP" | "USD";
}) {
  if (value === 0) {
    return <span className="font-semibold text-emerald-700">Cuadró</span>;
  }

  return (
    <span
      className={`font-semibold ${
        value > 0 ? "text-amber-700" : "text-red-700"
      }`}
    >
      {value > 0 ? "+" : "−"}
      {moneyCaja(Math.abs(value), moneda)}
    </span>
  );
}

function ArqueoRow({ arqueo }: { arqueo: CierreCaja }) {
  return (
    <tr className={tableRowClass}>
      <td className={`${tdClass} whitespace-nowrap`}>
        {formatDateTime(arqueo.fecha)}
      </td>
      <td className={`${tdClass} whitespace-nowrap`}>
        {arqueo.usuario || "—"}
      </td>
      <td className={tdClass}>
        <div className="whitespace-nowrap">
          <span className="text-muted">Esperado:</span>{" "}
          {moneyCaja(arqueo.saldo_esperado_cup, "CUP")}
        </div>
        <div className="whitespace-nowrap">
          <span className="text-muted">Real:</span>{" "}
          {moneyCaja(arqueo.saldo_real_cup, "CUP")}
        </div>
        <div className="whitespace-nowrap">
          <Diferencia value={arqueo.diferencia_cup} moneda="CUP" />
        </div>
      </td>
      <td className={tdClass}>
        <div className="whitespace-nowrap">
          <span className="text-muted">Esperado:</span>{" "}
          {moneyCaja(arqueo.saldo_esperado_usd, "USD")}
        </div>
        <div className="whitespace-nowrap">
          <span className="text-muted">Real:</span>{" "}
          {moneyCaja(arqueo.saldo_real_usd, "USD")}
        </div>
        <div className="whitespace-nowrap">
          <Diferencia value={arqueo.diferencia_usd} moneda="USD" />
        </div>
      </td>
      <td className={`${tdClass} min-w-[12rem] text-muted`}>
        {arqueo.notas || "—"}
      </td>
      <td className={`${tdClass} text-right`}>
        <Link
          href={`/finanzas/arqueos/${arqueo.id}/pdf`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Imprimir
        </Link>
      </td>
    </tr>
  );
}

export default async function ArqueosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await apiFetchEnvelope<ArqueosData>(
    `finanzas/arqueos/?page=${page}&per_page=20`,
  )
    .then((envelope) => ({ envelope, error: null }))
    .catch((error: unknown) => ({
      envelope: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los arqueos.",
    }));

  const arqueos = result.envelope?.data.arqueos ?? [];
  const pagination = result.envelope?.pagination as
    | ApiPagination
    | null
    | undefined;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <ClipboardCheck
              className="h-7 w-7 text-brand"
              aria-hidden="true"
            />
            Arqueos de caja
          </h1>
          <p className="mt-1 text-sm text-muted">
            Historial de cierres y diferencias de efectivo.
          </p>
        </div>
        <Link
          href="/finanzas/caja"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a Caja
        </Link>
      </div>

      {result.error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar los arqueos.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      ) : (
        <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
          {arqueos.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
              <SearchX
                className="mb-3 h-10 w-10 text-slate-300"
                aria-hidden="true"
              />
              <p className="font-semibold text-ink">No hay arqueos registrados</p>
              <p className="mt-1 text-sm">
                Realiza un cierre desde la página de Caja.
              </p>
            </div>
          ) : (
            <>
              <div className={tableWrapClass}>
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>Fecha</th>
                      <th className={thClass}>Usuario</th>
                      <th className={thClass}>CUP</th>
                      <th className={thClass}>USD</th>
                      <th className={thClass}>Notas</th>
                      <th className={`${thClass} text-right`}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arqueos.map((arqueo) => (
                      <ArqueoRow key={arqueo.id} arqueo={arqueo} />
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.num_pages > 1 ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted">
                    Mostrando {pagination.start_index}–{pagination.end_index} de{" "}
                    {pagination.count}
                  </div>
                  <nav
                    className="flex items-center gap-2"
                    aria-label="Paginación de arqueos"
                  >
                    {pagination.has_previous ? (
                      <Link
                        href={hrefForPage(pagination.page - 1)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition hover:border-brand hover:text-brand"
                      >
                        <ChevronLeft
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        Anterior
                      </Link>
                    ) : null}
                    <span className="text-sm font-semibold text-ink">
                      {pagination.page} / {pagination.num_pages}
                    </span>
                    {pagination.has_next ? (
                      <Link
                        href={hrefForPage(pagination.page + 1)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition hover:border-brand hover:text-brand"
                      >
                        Siguiente
                        <ChevronRight
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </Link>
                    ) : null}
                  </nav>
                </div>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}

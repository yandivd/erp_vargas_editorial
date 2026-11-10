import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  History,
  SearchX,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import CajaFilters from "@/components/finanzas/CajaFilters";
import CajaPagination from "@/components/finanzas/CajaPagination";
import CajaTable from "@/components/finanzas/CajaTable";
import MovimientoCajaModal from "@/components/finanzas/MovimientoCajaModal";
import { KpiCard, SectionCard } from "@/components/dashboard/ui";
import {
  apiFetch,
  apiFetchEnvelope,
  type ApiPagination,
} from "@/lib/api";
import {
  moneyCaja,
  type CajaData,
  type CajaResumen,
  type CategoriaCaja,
} from "@/lib/finanzas";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    categoria?: string;
    page?: string;
  }>;
};

type CajaMeta = {
  categorias?: CategoriaCaja[];
};

export default async function CajaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const desde = (params.desde ?? "").trim();
  const hasta = (params.hasta ?? "").trim();
  const categoria = (params.categoria ?? "").trim();
  const parsedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const movimientosQuery = new URLSearchParams();
  movimientosQuery.set("page", String(page));
  movimientosQuery.set("per_page", "10");
  if (desde) {
    movimientosQuery.set("desde", desde);
  }
  if (hasta) {
    movimientosQuery.set("hasta", hasta);
  }
  if (categoria) {
    movimientosQuery.set("categoria", categoria);
  }

  const resumenQuery = new URLSearchParams();
  if (desde) {
    resumenQuery.set("desde", desde);
  }
  if (hasta) {
    resumenQuery.set("hasta", hasta);
  }
  if (categoria) {
    resumenQuery.set("categoria", categoria);
  }
  const resumenPath = resumenQuery.toString()
    ? `finanzas/caja/resumen/?${resumenQuery.toString()}`
    : "finanzas/caja/resumen/";

  const [movimientosResult, resumenResult] = await Promise.all([
    apiFetchEnvelope<CajaData>(
      `finanzas/caja/?${movimientosQuery.toString()}`,
    )
      .then((envelope) => ({ envelope, error: null }))
      .catch((error: unknown) => ({
        envelope: null,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los movimientos de caja.",
      })),
    apiFetch<CajaResumen>(resumenPath)
      .then((resumen) => ({ resumen, error: null }))
      .catch((error: unknown) => ({
        resumen: null,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el resumen de caja.",
      })),
  ]);

  const movimientos = movimientosResult.envelope?.data.movimientos ?? [];
  const pagination = movimientosResult.envelope?.pagination as
    | ApiPagination
    | null
    | undefined;
  const meta = movimientosResult.envelope?.meta as CajaMeta | undefined;
  const resumen = resumenResult.resumen;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <Wallet className="h-7 w-7 text-brand" aria-hidden="true" />
            Caja
          </h1>
          <p className="mt-1 text-sm text-muted">
            Movimientos, saldos y arqueo de efectivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MovimientoCajaModal tipo="INGRESO" />
          <MovimientoCajaModal tipo="EGRESO" />
          <Link
            href="/finanzas/caja/arqueo"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Hacer Arqueo
          </Link>
          <Link
            href="/finanzas/arqueos"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand hover:text-brand"
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Historial
          </Link>
        </div>
      </div>

      {resumenResult.error ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el resumen de caja.</strong>
            <div>{resumenResult.error}</div>
          </div>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos del período"
          value={resumen ? moneyCaja(resumen.total_ingresos, "CUP") : "—"}
          sub="Movimientos operativos filtrados"
          tone="emerald"
        />
        <KpiCard
          label="Egresos del período"
          value={resumen ? moneyCaja(resumen.total_egresos, "CUP") : "—"}
          sub="Movimientos operativos filtrados"
          tone="red"
        />
        <KpiCard
          label="Saldo actual CUP"
          value={resumen ? moneyCaja(resumen.saldo_actual_cup, "CUP") : "—"}
          sub="Efectivo disponible en caja"
          tone="blue"
        />
        <KpiCard
          label="Saldo actual USD"
          value={resumen ? moneyCaja(resumen.saldo_actual_usd, "USD") : "—"}
          sub="Efectivo disponible en caja"
          tone="cyan"
        />
      </div>

      <CajaFilters
        initialDesde={desde}
        initialHasta={hasta}
        initialCategoria={categoria}
        categorias={meta?.categorias ?? []}
      />

      {movimientosResult.error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar los movimientos de caja.</strong>
            <div>{movimientosResult.error}</div>
          </div>
        </div>
      ) : (
        <SectionCard
          title="Movimientos de caja"
          icon={<ArrowUpCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
        >
          {movimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
              <SearchX
                className="mb-3 h-10 w-10 text-slate-300"
                aria-hidden="true"
              />
              <p className="font-semibold text-ink">
                No encontramos movimientos
              </p>
              <p className="mt-1 text-sm">
                Ajusta los filtros o registra un nuevo ingreso o gasto.
              </p>
            </div>
          ) : (
            <>
              <CajaTable movimientos={movimientos} />

              {pagination ? (
                <CajaPagination
                  pagination={pagination}
                  desde={desde}
                  hasta={hasta}
                  categoria={categoria}
                />
              ) : null}
            </>
          )}
        </SectionCard>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
            <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
            Ingresos manuales
          </div>
          <p className="mt-2 text-sm text-muted">
            Propinas, ventas directas y otros ingresos que no provienen de un
            pedido.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-red-700">
            <ArrowDownCircle className="h-4 w-4" aria-hidden="true" />
            Gastos manuales
          </div>
          <p className="mt-2 text-sm text-muted">
            Gastos operativos, compras de material y pagos registrados
            directamente en caja.
          </p>
        </div>
      </div>
    </div>
  );
}

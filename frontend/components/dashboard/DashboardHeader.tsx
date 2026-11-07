import Link from "next/link";
import {
  BookOpen,
  Bot,
  Filter,
  LayoutGrid,
  TrendingUp,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  DASHBOARD_TABS,
  type DashboardMeta,
  type DashboardTab,
} from "@/lib/dashboard";
import { formatDate, periodLabel } from "@/lib/format";

const tabIcons: Record<DashboardTab, LucideIcon> = {
  resumen: TrendingUp,
  produccion: BookOpen,
  clientes: Users,
};

function buildFilterQuery(desde: string, hasta: string): string {
  const params = new URLSearchParams();
  if (desde) {
    params.set("desde", desde);
  }
  if (hasta) {
    params.set("hasta", hasta);
  }
  return params.toString();
}

function tabHref(tab: DashboardTab, desde: string, hasta: string): string {
  const filter = buildFilterQuery(desde, hasta);
  return `/?tab=${tab}${filter ? `&${filter}` : ""}`;
}

export default function DashboardHeader({
  tab,
  desde,
  hasta,
  meta,
}: {
  tab: DashboardTab;
  desde: string;
  hasta: string;
  meta?: DashboardMeta;
}) {
  const djangoUrl = (process.env.NEXT_PUBLIC_DJANGO_URL ?? "").replace(/\/+$/, "");
  const filterQuery = buildFilterQuery(desde, hasta);
  const exportHref = djangoUrl
    ? `${djangoUrl}/exportar-ia/${filterQuery ? `?${filterQuery}` : ""}`
    : "#";

  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="mb-0 flex items-center gap-2 text-2xl font-bold text-ink">
            <LayoutGrid className="h-6 w-6 text-brand" aria-hidden="true" />
            Dashboard
          </h1>
          <p className="mb-0 text-muted">{periodLabel(meta)}</p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
          <form
            method="get"
            className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="tab" value={tab} />
            <div>
              <label
                htmlFor="desde"
                className="mb-0 block text-sm text-muted"
              >
                Desde
              </label>
              <input
                id="desde"
                type="date"
                name="desde"
                defaultValue={desde}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label
                htmlFor="hasta"
                className="mb-0 block text-sm text-muted"
              >
                Hasta
              </label>
              <input
                id="hasta"
                type="date"
                name="hasta"
                defaultValue={hasta}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filtrar
            </button>
          </form>

          <a
            href={exportHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            title="Descargar JSON para IA"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            Exportar para IA
          </a>

          <Link
            href={`/?tab=${tab}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Ver Todo
          </Link>
        </div>
      </div>

      {meta?.advertencia_tasa ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>La tasa de cambio no está configurada o es igual a 1.00.</strong>{" "}
          Configura <strong>Tasa_cambio</strong> en Parámetros para que los totales
          consolidados sean correctos.
        </div>
      ) : null}

      <div className="mb-4 flex flex-col justify-between gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm text-slate-700 md:flex-row">
        <span>
          <strong className="text-brand">Datos financieros</strong> desde el{" "}
          <strong>{formatDate(meta?.corte_financiero) || "02/08/2026"}</strong>
          {meta?.referencia_corte ? ` (referencia ${meta.referencia_corte})` : ""}.
        </span>
        <span className="text-muted">
          Producción y clientes conservan el historial completo.
        </span>
      </div>

      <nav className="mb-4 flex flex-nowrap gap-1 overflow-x-auto border-b border-line">
        {DASHBOARD_TABS.map((item) => {
          const Icon = tabIcons[item.id];
          const active = item.id === tab;

          return (
            <Link
              key={item.id}
              href={tabHref(item.id, desde, hasta)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-muted hover:text-slate-700"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

import Link from "next/link";
import {
  AlertTriangle,
  Clock3,
  Eye,
  History,
  SearchX,
  Truck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import type { EntregaListItem } from "@/lib/entregas";
import {
  KpiCard,
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

type Tab = "pendientes" | "historial";

const TABS: { key: Tab; label: string; icon: typeof Truck }[] = [
  { key: "pendientes", label: "Pendientes", icon: Clock3 },
  { key: "historial", label: "Historial", icon: History },
];

function estadoBadge(entregado: boolean) {
  return entregado
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
}

export default async function EntregasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = params.tab === "historial" ? "historial" : "pendientes";

  let entregas: EntregaListItem[] = [];
  let error = "";
  let totalPorCobrar = 0;
  let pedidos = 0;

  try {
    const data = await apiFetch<EntregaListItem[]>(
      `entregas/?tab=${encodeURIComponent(tab)}`,
    );
    entregas = data;
    totalPorCobrar = data.reduce(
      (total, entrega) => total + Number(entrega.total_a_cobrar),
      0,
    );
    pedidos = data.reduce(
      (total, entrega) => total + entrega.cantidad_pedidos,
      0,
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudieron cargar las entregas.";
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-ink md:text-2xl">
              Entregas
            </h1>
            <p className="text-sm text-muted">
              Pedidos agrupados para despacho y cobro final
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label={tab === "pendientes" ? "Entregas pendientes" : "Entregas realizadas"}
          value={String(entregas.length)}
          tone="blue"
        />
        <KpiCard
          label="Pedidos incluidos"
          value={String(pedidos)}
          tone="cyan"
        />
        <KpiCard
          label="Total a cobrar"
          value={money(totalPorCobrar)}
          tone="emerald"
        />
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(({ key, label, icon: Icon }) => {
          const activo = tab === key;
          return (
            <Link
              key={key}
              href={`/entregas?tab=${key}`}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                activo
                  ? "bg-navy-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : entregas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <SearchX className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-base font-semibold text-slate-800">
            No hay entregas en esta vista
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {tab === "pendientes"
              ? "Las entregas confirmadas aparecerán en el historial."
              : "Todavía no se ha confirmado ninguna entrega."}
          </p>
        </div>
      ) : (
        <div className={tableWrapClass}>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Cliente</th>
                  <th className={thClass}>Fecha</th>
                  <th className={thClass}>Pedidos</th>
                  <th className={thClass}>Total a cobrar</th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((entrega) => (
                  <tr key={entrega.id} className={tableRowClass}>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-900">
                        {entrega.cliente_nombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        Entrega #{entrega.id}
                      </p>
                    </td>
                    <td className={tdClass}>
                      {formatDate(
                        entrega.fecha_entrega || entrega.fecha_creacion,
                      )}
                    </td>
                    <td className={tdClass}>{entrega.cantidad_pedidos}</td>
                    <td className={tdClass}>
                      <p className="font-semibold text-slate-900">
                        {money(entrega.total_a_cobrar)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Saldo: {money(entrega.saldo_pedidos)}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                          estadoBadge(entrega.entregado),
                        ].join(" ")}
                      >
                        {entrega.estado}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Link
                        href={`/entregas/${entrega.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

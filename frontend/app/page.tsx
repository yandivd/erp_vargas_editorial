import { AlertTriangle } from "lucide-react";
import ClientesTab from "@/components/dashboard/ClientesTab";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProduccionTab from "@/components/dashboard/ProduccionTab";
import ResumenTab from "@/components/dashboard/ResumenTab";
import { apiFetch } from "@/lib/api";
import {
  isDashboardTab,
  type DashboardClientes,
  type DashboardData,
  type DashboardProduccion,
  type DashboardResumen,
  type DashboardTab,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    desde?: string;
    hasta?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab: DashboardTab = isDashboardTab(params.tab) ? params.tab : "resumen";
  const desde = params.desde ?? "";
  const hasta = params.hasta ?? "";

  const query = new URLSearchParams();
  if (desde) {
    query.set("desde", desde);
  }
  if (hasta) {
    query.set("hasta", hasta);
  }

  const queryString = query.toString();
  let data: DashboardData | null = null;
  let error: string | null = null;

  try {
    data = await apiFetch<DashboardData>(
      `dashboard/${tab}/${queryString ? `?${queryString}` : ""}`,
    );
  } catch (requestError) {
    error =
      requestError instanceof Error
        ? requestError.message
        : "No se pudieron cargar los datos del dashboard.";
  }

  const meta =
    data && "meta" in data
      ? (data as DashboardResumen).meta
      : undefined;

  return (
    <div>
      <DashboardHeader
        tab={tab}
        desde={desde}
        hasta={hasta}
        meta={meta}
      />

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el dashboard.</strong>
            <div>{error}</div>
          </div>
        </div>
      ) : null}

      {data && tab === "resumen" ? (
        <ResumenTab data={data as DashboardResumen} />
      ) : null}

      {data && tab === "produccion" ? (
        <ProduccionTab data={data as DashboardProduccion} />
      ) : null}

      {data && tab === "clientes" ? (
        <ClientesTab data={data as DashboardClientes} />
      ) : null}
    </div>
  );
}

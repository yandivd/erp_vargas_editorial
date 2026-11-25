import DashboardTabsClient from "@/components/dashboard/DashboardTabsClient";
import { isDashboardTab, type DashboardPeriodMode } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    desde?: string;
    hasta?: string;
    modo?: string;
  }>;
};

function fechaLocal(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Havana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function resolverPeriodo(params: {
  desde?: string;
  hasta?: string;
  modo?: string;
}): { desde: string; hasta: string; modo: DashboardPeriodMode } {
  if (params.modo === "global") {
    return { desde: "", hasta: "", modo: "global" };
  }

  if (
    params.modo === "personalizado" ||
    ((params.desde || params.hasta) && params.modo !== "anual")
  ) {
    return {
      desde: params.desde ?? "",
      hasta: params.hasta ?? "",
      modo: "personalizado",
    };
  }

  const hoy = fechaLocal();
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, modo: "anual" };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = isDashboardTab(params.tab) ? params.tab : "resumen";
  const { desde, hasta, modo } = resolverPeriodo(params);

  return (
    <DashboardTabsClient
      tab={tab}
      desde={desde}
      hasta={hasta}
      modo={modo}
      meta={{
        desde,
        hasta,
        modo,
        corte_financiero: "2026-08-02",
        referencia_corte: 487,
      }}
    />
  );
}

import DashboardTabsClient from "@/components/dashboard/DashboardTabsClient";
import { isDashboardTab } from "@/lib/dashboard";

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
  const tab = isDashboardTab(params.tab) ? params.tab : "resumen";
  const desde = params.desde ?? "";
  const hasta = params.hasta ?? "";

  return (
    <DashboardTabsClient
      tab={tab}
      desde={desde}
      hasta={hasta}
      meta={{
        desde,
        hasta,
        corte_financiero: "2026-08-02",
        referencia_corte: 487,
      }}
    />
  );
}

import Skeleton from "@/components/ui/Skeleton";
import type { DashboardTab } from "@/lib/dashboard";

const labels: Record<DashboardTab, string> = {
  resumen: "Resumen",
  produccion: "Producción",
  clientes: "Clientes",
  fidelidad: "Fidelidad",
  leads: "Leads",
};

export default function DashboardTabSkeleton({
  tab,
}: {
  tab: DashboardTab;
}) {
  return (
    <div role="status" aria-label={`Cargando ${labels[tab]}`}>
      <span className="sr-only">Cargando {labels[tab]}...</span>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={`kpi-${index}`}
            className="rounded-xl border border-line border-t-4 border-t-slate-200 bg-white p-5"
          >
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="mb-3 h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={`chart-${index}`}
            className="rounded-xl border border-line bg-white p-4 md:p-6"
          >
            <Skeleton className="mb-5 h-5 w-48" />
            <Skeleton className="h-[180px] w-full md:h-[220px]" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-white p-4 md:p-6">
        <Skeleton className="mb-5 h-5 w-56" />
        <Skeleton className="h-[220px] w-full md:h-[280px]" />
      </div>
    </div>
  );
}

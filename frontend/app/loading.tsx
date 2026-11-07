import Skeleton from "@/components/ui/Skeleton";

const kpiGroups = [4, 4, 4];
const chartWidths = ["w-28", "w-36", "w-24", "w-32"];

export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Cargando dashboard">
      <span className="sr-only">Cargando dashboard...</span>

      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <Skeleton className="mb-4 h-12 w-full rounded-lg" />

      {kpiGroups.map((count, groupIndex) => (
        <div
          key={`kpi-group-${groupIndex}`}
          className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3"
        >
          {Array.from({ length: count }, (_, index) => (
            <div
              key={`kpi-${groupIndex}-${index}`}
              className="rounded-xl border border-line border-t-4 border-t-slate-200 bg-white p-5"
            >
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="mb-3 h-7 w-32" />
              <Skeleton className={`h-3 ${chartWidths[(groupIndex + index) % chartWidths.length]}`} />
            </div>
          ))}
        </div>
      ))}

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

      <div className="mb-4 grid gap-3 md:grid-cols-7">
        <div className="rounded-xl border border-line bg-white p-4 md:col-span-4 md:p-6">
          <Skeleton className="mb-5 h-5 w-44" />
          <Skeleton className="h-[220px] w-full md:h-[280px]" />
        </div>
        <div className="rounded-xl border border-line bg-white p-4 md:col-span-3 md:p-6">
          <Skeleton className="mb-5 h-5 w-36" />
          <Skeleton className="h-[220px] w-full md:h-[280px]" />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-4 md:p-6">
        <Skeleton className="mb-5 h-5 w-56" />
        <Skeleton className="h-[220px] w-full md:h-[280px]" />
      </div>
    </div>
  );
}

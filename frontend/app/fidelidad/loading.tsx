import Skeleton from "@/components/ui/Skeleton";

export default function FidelidadLoading() {
  return (
    <div role="status" aria-label="Cargando fidelidad">
      <span className="sr-only">Cargando fidelidad...</span>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4 md:p-6">
          <Skeleton className="mb-5 h-5 w-44" />
          <Skeleton className="h-[220px] w-full md:h-[280px]" />
        </div>
        <div className="rounded-xl border border-line bg-white p-4 md:p-6">
          <Skeleton className="mb-5 h-5 w-36" />
          <Skeleton className="h-[220px] w-full md:h-[280px]" />
        </div>
      </div>
    </div>
  );
}

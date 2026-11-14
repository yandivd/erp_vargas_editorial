import Skeleton from "@/components/ui/Skeleton";

export default function TiendaLoading() {
  return (
    <div role="status" aria-label="Cargando tienda">
      <span className="sr-only">Cargando tienda...</span>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <Skeleton className="mb-5 h-6 w-48" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    </div>
  );
}

import Skeleton from "@/components/ui/Skeleton";

export default function EntregaTicketLoading() {
  return (
    <div role="status" aria-label="Cargando ticket de entrega">
      <span className="sr-only">Cargando ticket de entrega...</span>
      <div className="rounded-xl border border-line bg-white p-6 md:p-8">
        <Skeleton className="mb-5 h-6 w-64" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    </div>
  );
}

import Skeleton from "@/components/ui/Skeleton";

export default function FinanzasArqueoPdfLoading() {
  return (
    <div role="status" aria-label="Cargando PDF de arqueo">
      <span className="sr-only">Cargando PDF de arqueo...</span>
      <div className="rounded-xl border border-line bg-white p-6 md:p-8">
        <Skeleton className="mb-5 h-6 w-56" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    </div>
  );
}

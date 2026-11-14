import Skeleton from "@/components/ui/Skeleton";

export default function LoginLoading() {
  return (
    <div role="status" aria-label="Cargando inicio de sesión">
      <span className="sr-only">Cargando inicio de sesión...</span>
      <div className="rounded-xl border border-line bg-white p-6 md:p-8">
        <Skeleton className="mb-5 h-6 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-2/3" />
        <Skeleton className="mt-6 h-11 w-full" />
      </div>
    </div>
  );
}

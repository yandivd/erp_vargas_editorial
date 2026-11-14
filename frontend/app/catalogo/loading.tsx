import Skeleton from "@/components/ui/Skeleton";
import { tableWrapClass } from "@/components/dashboard/ui";

export default function CatalogoLoading() {
  const rows = Array.from({ length: 8 }, (_, index) => index);

  return (
    <div role="status" aria-label="Cargando catálogo">
      <span className="sr-only">Cargando catálogo...</span>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <Skeleton className="mb-4 h-12 w-56 rounded-xl" />

      <div className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <Skeleton className="h-6 w-56" />
        <div className={tableWrapClass}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b-2 border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  <Skeleton className="h-3 w-20" />
                </th>
                <th className="border-b-2 border-line px-2 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  <Skeleton className="h-3 w-32" />
                </th>
                <th className="border-b-2 border-line px-2 py-2 text-right text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  <Skeleton className="ml-auto h-3 w-24" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`row-${row}`}>
                  <td className="border-b border-line px-2 py-2">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="border-b border-line px-2 py-2">
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="border-b border-line px-2 py-2 text-right">
                    <Skeleton className="ml-auto h-4 w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

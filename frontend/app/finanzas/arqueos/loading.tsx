import Skeleton from "@/components/ui/Skeleton";
import {
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";

const rows = Array.from({ length: 8 }, (_, index) => index);
const widths = ["w-10", "w-12", "w-40", "w-48", "w-24", "w-16"];

export default function FinanzasArqueosLoading() {
  return (
    <div role="status" aria-label="Cargando arqueos">
      <span className="sr-only">Cargando arqueos...</span>

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
          <table className={tableClass}>
            <thead>
              <tr>
                {widths.map((width, index) => (
                  <th key={`head-${index}`} className={thClass}>
                    <Skeleton className={`h-3 ${width}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`row-${row}`}>
                  {widths.map((width, index) => (
                    <td key={`cell-${row}-${index}`} className={tdClass}>
                      <Skeleton
                        className={`h-4 ${width} ${index === widths.length - 1 ? "rounded-full" : ""}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import Skeleton from "@/components/ui/Skeleton";
import {
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";

const rows = Array.from({ length: 8 }, (_, index) => index);
const widths = ["w-10", "w-12", "w-32", "w-40", "w-24", "w-16", "w-8"];

export default function PedidosContentSkeleton() {
  return (
    <div role="status" aria-label="Cargando pedidos">
      <span className="sr-only">Cargando pedidos...</span>

      <div className="mb-4 rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-48" />
          <Skeleton className="h-10 w-full sm:w-24" />
        </div>
      </div>

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
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
      </section>
    </div>
  );
}

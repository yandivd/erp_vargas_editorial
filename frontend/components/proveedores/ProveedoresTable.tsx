import { Eye, Phone, Truck } from "lucide-react";
import Link from "next/link";
import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { money } from "@/lib/format";
import type { Proveedor } from "@/lib/proveedores";

export default function ProveedoresTable({
  proveedores,
}: {
  proveedores: Proveedor[];
}) {
  return (
    <div className={tableWrapClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Nombre</th>
            <th className={thClass}>Teléfono</th>
            <th className={thClass}>Deuda Pendiente</th>
            <th className={`${thClass} text-right`}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {proveedores.map((proveedor) => {
            const deuda = Number(proveedor.deuda_total ?? 0);

            return (
              <tr key={proveedor.id} className={tableRowClass}>
                <td className={tdClass}>
                  <div className="font-bold text-ink">{proveedor.nombre}</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-600">
                    <Truck className="h-3 w-3" aria-hidden="true" />
                    {proveedor.tipo_label}
                  </div>
                </td>
                <td className={tdClass}>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {proveedor.telefono || "—"}
                  </span>
                </td>
                <td className={tdClass}>
                  {deuda > 0 ? (
                    <span className="font-bold text-red-600">
                      {money(deuda)}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Sin deuda
                    </span>
                  )}
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link
                    href={`/proveedores/${proveedor.id}/lotes`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Ver Lotes
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

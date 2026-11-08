import { Eye, Phone } from "lucide-react";
import Link from "next/link";
import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { badgeClass, type ClienteListItem } from "@/lib/clientes";
import { money } from "@/lib/format";

export default function ClientesTable({
  clientes,
}: {
  clientes: ClienteListItem[];
}) {
  return (
    <div className={tableWrapClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Nombre</th>
            <th className={`${thClass} hidden lg:table-cell`}>Segmento</th>
            <th className={`${thClass} hidden sm:table-cell`}>Pedidos</th>
            <th className={thClass}>Saldo Pendiente</th>
            <th className={`${thClass} text-right`}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => {
            const saldo = Number(cliente.saldo_pendiente);

            return (
              <tr key={cliente.id} className={tableRowClass}>
                <td className={tdClass}>
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="font-bold text-ink transition hover:text-brand hover:underline"
                  >
                    {cliente.nombre}
                  </Link>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted sm:hidden">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {cliente.telefono || "—"}
                  </div>
                </td>
                <td className={`${tdClass} hidden lg:table-cell`}>
                  {cliente.badge ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(
                        cliente.badge.color,
                      )}`}
                      title={`${cliente.total_libros} libros · ${cliente.dias_sin_comprar} días sin comprar`}
                    >
                      <span aria-hidden="true">{cliente.badge.emoji}</span>
                      {cliente.badge.label}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className={`${tdClass} hidden sm:table-cell`}>
                  <span className="inline-flex min-w-8 justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {cliente.pedidos}
                  </span>
                </td>
                <td className={tdClass}>
                  {saldo > 0 ? (
                    <span className="font-bold text-red-600">
                      {money(saldo)}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Al día
                    </span>
                  )}
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Ver
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

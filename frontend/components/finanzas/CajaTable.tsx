import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { formatDateTime } from "@/lib/format";
import { moneyCaja, type MovimientoCaja } from "@/lib/finanzas";

export default function CajaTable({
  movimientos,
}: {
  movimientos: MovimientoCaja[];
}) {
  return (
    <div className={tableWrapClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Tipo</th>
            <th className={thClass}>Concepto</th>
            <th className={thClass}>Categoría</th>
            <th className={thClass}>Método</th>
            <th className={`${thClass} text-right`}>Monto</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((movimiento) => {
            const esIngreso = movimiento.tipo === "INGRESO";

            return (
              <tr key={movimiento.id} className={tableRowClass}>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {formatDateTime(movimiento.fecha)}
                </td>
                <td className={tdClass}>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      esIngreso
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {movimiento.tipo_label}
                  </span>
                </td>
                <td className={`${tdClass} min-w-[16rem]`}>
                  {movimiento.concepto || "—"}
                </td>
                <td className={tdClass}>{movimiento.categoria_label}</td>
                <td className={tdClass}>{movimiento.metodo_label}</td>
                <td className={`${tdClass} whitespace-nowrap text-right`}>
                  <span
                    className={`font-bold ${
                      esIngreso ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {esIngreso ? "+" : "−"}
                    {moneyCaja(movimiento.monto, movimiento.moneda)}
                  </span>{" "}
                  <span className="text-xs text-muted">
                    {movimiento.moneda}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { money } from "@/lib/format";
import type { CostoCalculado } from "@/lib/costos";

type DesgloseCostosProps = {
  costo: CostoCalculado | null | undefined;
  className?: string;
};

export default function DesgloseCostos({
  costo,
  className = "",
}: DesgloseCostosProps) {
  if (!costo) {
    return null;
  }

  const recursos = [
    { label: "Papel", value: costo.costo_papel },
    { label: "Tinta", value: costo.costo_tinta },
    { label: "Pegamento", value: costo.costo_pegamento },
    { label: "Scotch", value: costo.costo_scotch },
    { label: "Esquineros", value: costo.costo_esquineros },
    { label: "Portada", value: costo.costo_portada },
    { label: "Encuadernación", value: costo.costo_encuadernacion },
    { label: "Electricidad", value: costo.costo_electricidad },
    { label: "Diseño", value: costo.costo_diseno },
  ];

  return (
    <div
      className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted ${className}`}
    >
      {recursos.map((recurso) => (
        <span key={recurso.label}>
          {recurso.label} {money(recurso.value)}
        </span>
      ))}
    </div>
  );
}

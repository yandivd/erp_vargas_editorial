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

  const c:any = costo;
  const tasa = c.tasa_cambio || 1;
  const recursos = [
    { label: "Papel", cup: c.costo_papel ?? 0 },
    { label: "Tinta", cup: c.costo_tinta ?? 0 },
    { label: "Pegamento", cup: c.costo_pegamento ?? 0 },
    { label: "Cantos tintados", cup: c.costo_scotch ?? 0 },
    { label: "Esquineros", cup: c.costo_esquineros ?? 0 },
    { label: "Portada", cup: c.costo_portada ?? 0 },
    { label: "Encuadernación", cup: c.costo_encuadernacion ?? 0 },
    { label: "Electricidad", cup: c.costo_electricidad ?? 0 },
    { label: "Diseño", cup: c.costo_diseno ?? 0 },
  ];

  return (
    <div
      className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted ${className}`}
    >
      {recursos.map((recurso) => (
        <span key={recurso.label}>
          {recurso.label} {money(recurso.cup, "CUP")}
        </span>
      ))}
    </div>
  );
}

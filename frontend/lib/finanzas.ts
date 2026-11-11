import { apiFetch } from "./api";
import { money, number } from "./format";

export type MonedaCaja = "CUP" | "USD";
export type TipoMovimientoCaja = "INGRESO" | "EGRESO";

export type MovimientoCaja = {
  id: number;
  tipo: TipoMovimientoCaja;
  tipo_label: string;
  categoria: string;
  categoria_label: string;
  monto: number;
  moneda: MonedaCaja;
  moneda_label: string;
  metodo: string;
  metodo_label: string;
  concepto: string;
  fecha: string;
  pedido_id: number | null;
  proveedor_id: number | null;
  proveedor_nombre: string;
};

export type CategoriaCaja = {
  value: string;
  label: string;
};

export type CajaData = {
  movimientos: MovimientoCaja[];
};

export type CajaResumen = {
  total_ingresos: number;
  total_egresos: number;
  saldo_actual_cup: number;
  saldo_actual_usd: number;
  tasa_usd: number;
  depreciacion_activos_mensual: number;
};

export type DivisaOperacionResponse = {
  operacion: string;
  monto_usd: number;
  tasa_cambio: number;
  monto_total_cup: number;
  lote?: {
    id: number;
    cantidad_disponible: number;
    precio_compra: number;
  };
  ganancia?: number;
};

export type CierreCaja = {
  id: number;
  fecha: string;
  usuario: string;
  saldo_esperado_cup: number;
  saldo_real_cup: number;
  diferencia_cup: number;
  saldo_esperado_usd: number;
  saldo_real_usd: number;
  diferencia_usd: number;
  transferencia: number;
  notas: string;
};

export type ArqueosData = {
  arqueos: CierreCaja[];
};

export type MovimientoCajaResponse = {
  movimiento: MovimientoCaja;
};

export type ArqueoResponse = {
  arqueo: CierreCaja;
  ajustes: MovimientoCaja[];
};

export const CATEGORIAS_INGRESO_MANUAL: CategoriaCaja[] = [
  { value: "INGRESO_MANUAL", label: "Ingreso manual" },
  { value: "PROPINA", label: "Propina" },
  { value: "MENSAJERIA", label: "Mensajería / Envío" },
  { value: "VENTA_DIRECTA", label: "Venta directa" },
  { value: "OTRO_INGRESO", label: "Otro ingreso" },
];

export const CATEGORIAS_GASTO_MANUAL: CategoriaCaja[] = [
  { value: "GASTO_OPERATIVO", label: "Gasto operativo" },
  { value: "COMPRA_MATERIAL", label: "Compra de material" },
  { value: "PAGO_PROVEEDOR", label: "Pago a proveedor" },
  { value: "COMPRA_ACTIVO", label: "Compra de activo fijo" },
];

export const METODOS_CAJA = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "OTRO", label: "Otro" },
];

export const MONEDAS_CAJA: { value: MonedaCaja; label: string }[] = [
  { value: "CUP", label: "CUP" },
  { value: "USD", label: "USD" },
];

export function moneyCaja(
  value: number | string | null | undefined,
  moneda: MonedaCaja | string,
): string {
  if (moneda === "USD") {
    return `US$${number(value)}`;
  }

  return money(value);
}

export async function registrarCompraDivisa(payload: {
  monto_usd: number;
  tasa_cambio: number;
}) {
  return apiFetch<DivisaOperacionResponse>(
    "finanzas/divisas/compra/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function registrarVentaDivisa(payload: {
  monto_usd: number;
  tasa_cambio: number;
}) {
  return apiFetch<DivisaOperacionResponse>(
    "finanzas/divisas/venta/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

import type { ApiPagination } from "@/lib/api";

export type InventarioMaterial = {
  id: number;
  nombre: string;
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  stock_bajo: boolean;
  alerta: boolean;
};

export type InventarioListResponse = {
  ok: true;
  data: {
    materiales: InventarioMaterial[];
  };
  pagination?: ApiPagination | null;
  meta?: unknown;
};

export type InventarioMovimientoResponse = {
  ok: true;
  data: {
    movimiento: {
      id: number;
      tipo: string;
      cantidad: number;
      costo_total: number;
      motivo: string;
      pedido_id: number | null;
    };
    material: {
      id: number;
      stock_actual: number;
      stock_minimo: number;
      stock_bajo: boolean;
      alerta: boolean;
    };
  };
};

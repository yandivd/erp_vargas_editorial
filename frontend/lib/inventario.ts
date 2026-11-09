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

export type InventarioPedidoResumen = {
  id: number;
  referencia_externa: number | null;
};

export type InventarioUsuarioResumen = {
  id: number;
  nombre: string;
};

export type InventarioHistorialMovimiento = {
  id: number;
  fecha: string;
  tipo: string;
  tipo_label: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  motivo: string;
  pedido: InventarioPedidoResumen | null;
  usuario: InventarioUsuarioResumen | null;
};

export type InventarioHistorialData = {
  material: {
    id: number;
    nombre: string;
    unidad_medida: string;
    stock_actual: number;
    stock_minimo: number;
    stock_bajo: boolean;
  };
  movimientos: InventarioHistorialMovimiento[];
};

export type InventarioOrdenTrabajoData = {
  movimiento: {
    id: number;
    tipo: string;
    tipo_label: string;
    fecha: string;
    cantidad: number;
    motivo: string;
  };
  material: {
    id: number;
    nombre: string;
    unidad_medida: string;
  };
  pedido: InventarioPedidoResumen | null;
  solicitante: string;
  almacenero: string;
  ceo: string;
};

export type ProveedorTipo =
  | "IMPRENTA_PORTADA"
  | "ENCUADERNADOR"
  | "PAPELERIA"
  | "OTRO";

export type Proveedor = {
  id: number;
  nombre: string;
  tipo: ProveedorTipo;
  tipo_label: string;
  telefono: string;
  direccion: string;
  notas: string;
  activo: boolean;
  deuda_total: number;
};

export type ServicioLote = {
  id: number;
  pedido_id: number;
  referencia_externa: number | null;
  libro_titulo: string;
  cantidad: number;
  cliente_nombre: string;
  tipo: string;
  tipo_label: string;
  monto: number;
  estado: string;
  estado_label: string;
};

export type LoteServicio = {
  id: number;
  numero: string;
  tipo: string;
  tipo_label: string;
  estado: string;
  estado_label: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
  fecha_pago: string | null;
  notas: string;
  cantidad_servicios: number;
  total: number;
  total_pendiente: number;
  servicios: ServicioLote[];
};

export type ProveedorLotesData = {
  proveedor: Proveedor;
  abiertos: LoteServicio[];
  pagados: LoteServicio[];
};

export type PedidoLote = {
  pedido_id: number;
  referencia_externa: number | null;
  libro_titulo: string;
  cantidad: number;
  cliente_nombre: string;
  monto: number;
  servicios: number;
};

export type LoteOrdenData = {
  lote: LoteServicio;
  proveedor: Proveedor;
  pedidos: PedidoLote[];
};

export type PagoLoteData = {
  lote: LoteServicio;
  movimiento: {
    id: number;
    tipo_label: string;
    categoria_label: string;
    monto: number;
    moneda_label: string;
    metodo_label: string;
    concepto: string;
    fecha: string;
    proveedor_nombre: string;
  } | null;
  movimientos: unknown[];
  total_pagado: number;
  total_recibido_cup: number;
  vuelto_cup: number;
  tasa_aplicada: number | null;
};

export const TIPOS_PROVEEDOR: { value: ProveedorTipo; label: string }[] = [
  { value: "IMPRENTA_PORTADA", label: "Imprenta de portada" },
  { value: "ENCUADERNADOR", label: "Encuadernador" },
  { value: "PAPELERIA", label: "Papelería" },
  { value: "OTRO", label: "Otro" },
];

export function referenciaPedido(
  referencia: number | null,
  id: number,
): string {
  return referencia ? `#${referencia}` : `#${id}`;
}

export type EstadoPedido = {
  id: number;
  nombre: string;
  color: string;
  orden: number;
  es_final: boolean;
  activo: boolean;
  es_taller: boolean;
};

export type PedidoListItem = {
  id: number;
  referencia_externa: number | null;
  cliente_id: number | null;
  cliente_nombre: string;
  libro_id: number;
  libro_titulo: string;
  libro_autor: string;
  cantidad: number;
  estado_id: number;
  estado_nombre: string;
  estado_color: string;
  estado_es_final: boolean;
  precio_venta: string;
  anticipo_requerido: string;
  anticipo_recibido: string;
  saldo_pendiente: string;
  fecha_pedido: string;
  fecha_entrega_prometida: string | null;
  fecha_entrega_real: string | null;
  es_historico: boolean;
};

export type AnticipoPedido = {
  id: number;
  monto: string;
  moneda: string;
  metodo: string;
  metodo_display: string;
  categoria: string;
  categoria_display: string;
  concepto: string;
  fecha: string;
};

export type ServicioExternoPedido = {
  id: number;
  proveedor_id: number;
  proveedor_nombre: string;
  tipo: string;
  tipo_display: string;
  monto: string;
  estado: string;
  estado_display: string;
  fecha_solicitud: string;
  fecha_recepcion: string | null;
  fecha_pago: string | null;
  notas: string;
  lote_id: number | null;
  lote_numero: string | null;
};

export type PedidoDetail = PedidoListItem & {
  lleva_scotch: boolean;
  lleva_esquineros: boolean;
  direccion_entrega: string;
  telefono_entrega: string;
  notas: string;
  descuento_aplicado: string;
  horas_invertidas: string | null;
  cliente_telefono: string;
  cliente_direccion: string;
  dias_para_entrega: number | null;
  esta_atrasado: boolean;
  ganancia_bruta: string;
  anticipos: AnticipoPedido[];
  servicios_externos: ServicioExternoPedido[];
};

export type CambioEstadoMasivoResultado = {
  actualizados: number;
  estado: {
    id: number;
    nombre: string;
  };
  errores: string[];
};

export type MetodoPago = {
  value: string;
  label: string;
};

export const METODOS_PAGO: MetodoPago[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "OTRO", label: "Otro" },
];

export function estadoStyle(color: string): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  return {
    backgroundColor: `${color}18`,
    color,
    borderColor: `${color}45`,
  };
}

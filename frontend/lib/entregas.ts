import type { ServicioExternoPedido } from "./pedidos";

export type EntregaListItem = {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  direccion: string;
  fecha_creacion: string;
  fecha_entrega: string | null;
  fecha_entrega_real: string | null;
  entregado: boolean;
  estado: string;
  cantidad_pedidos: number;
  total_pedidos: string;
  total_anticipos: string;
  saldo_pedidos: string;
  costo_mensajeria: string;
  total_a_cobrar: string;
};

export type EntregaPedido = {
  id: number;
  referencia_externa: string;
  libro_titulo: string;
  libro_autor: string;
  cantidad: number;
  precio_venta: string;
  anticipo_recibido: string;
  saldo_pendiente: string;
  estado_nombre: string;
  servicios_externos: ServicioExternoPedido[];
};

export type EntregaDetail = EntregaListItem & {
  cliente_telefono: string;
  cliente_direccion: string;
  notas: string;
  pedidos: EntregaPedido[];
};

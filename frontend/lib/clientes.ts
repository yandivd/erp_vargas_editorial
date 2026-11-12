import type { PedidoListItem } from "@/lib/pedidos";

export type ClienteBadge = {
  label: string;
  emoji: string;
  color: string;
};

export type FidelidadCliente = {
  sellos: number;
  bono_saldo: number;
  meta: number;
  faltantes: number;
  tiene_bono: boolean;
  token: string;
  porcentaje: number;
};

export type ClienteListItem = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  notas: string;
  fecha_registro: string;
  pedidos: number;
  saldo_pendiente: number;
  total_libros: number;
  dias_sin_comprar: number;
  badge: ClienteBadge | null;
  fidelidad?: FidelidadCliente | null;
};

export type ClienteEstadisticas = {
  total_pedidos: number;
  total_facturado: number;
  total_pagado: number;
  total_deuda: number;
};

export type ClienteDetail = ClienteListItem & {
  estadisticas: ClienteEstadisticas;
  historial_pedidos: PedidoListItem[];
};

const BADGE_COLORS: Record<string, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  secondary: "border-slate-200 bg-slate-50 text-slate-600",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  primary: "border-blue-200 bg-blue-50 text-blue-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  dark: "border-slate-700 bg-slate-800 text-white",
};

export function badgeClass(color: string): string {
  return BADGE_COLORS[color] ?? BADGE_COLORS.secondary;
}

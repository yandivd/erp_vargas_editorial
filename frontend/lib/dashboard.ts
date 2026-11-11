export type DashboardTab = "resumen" | "produccion" | "clientes";

export type DashboardMeta = {
  desde: string;
  hasta: string;
  corte_financiero?: string;
  referencia_corte?: number;
  tasa_cambio?: number;
  advertencia_tasa?: boolean;
  formula_ganancia?: string;
};

export type ResumenKpis = {
  ingresos_brutos_cup: number;
  vuelto_clientes_cup: number;
  ingresos_cup: number;
  gastos_cup: number;
  gastos_totales_cup: number;
  saldo_neto_cup: number;
  flujo_neto_cup: number;
  ingresos_brutos_usd: number;
  vuelto_clientes_usd: number;
  ingresos_usd: number;
  gastos_usd: number;
  saldo_neto_usd: number;
  flujo_neto_usd: number;
  ingresos_brutos_equiv_cup: number;
  vuelto_clientes_equiv_cup: number;
  ingresos_equiv_cup: number;
  gastos_equiv_cup: number;
  gastos_totales_equiv_cup: number;
  depreciacion_activos_cup: number;
  saldo_neto_equiv_cup: number;
  saldo_neto_contable_cup: number;
  saldo_neto_equiv_usd: number;
  saldo_caja_cup: number;
  saldo_caja_usd: number;
  saldo_caja_equiv_cup: number;
  saldo_caja_equiv_usd: number;
  margen: number;
  margen_operativo: number;
  total_pedidos: number;
  clientes_unicos: number;
  ventas: number;
  ganancia_promedio_cup: number;
  ganancia_promedio_usd: number;
  pasivos_cup: number;
  anticipos_cup: number;
  servicios_impagos_cup: number;
  pedidos_activos: number;
};

export type DesgloseIngreso = {
  categoria: string;
  total: number;
};

export type CostoUnitario = {
  material: string;
  unidad: string;
  cantidad: number;
  costo_total: number;
  costo_unitario: number;
};

export type TendenciaMes = {
  mes: string;
  ingresos_brutos: number;
  vuelto_clientes: number;
  ingresos: number;
  gastos: number;
};

export type ProyeccionMes = {
  mes: string;
  ingresos: number;
  gastos: number;
};

export type SemanaMovimiento = {
  semana: string;
  ingresos_brutos: number;
  vuelto_clientes: number;
  ingresos: number;
  gastos: number;
};

export type CalorDia = {
  dia: string;
  valores: number[];
};

export type Calor = {
  horas: string[];
  filas: CalorDia[];
  max: number;
};

export type Transaccion = {
  fecha: string;
  tipo: string;
  concepto: string;
  categoria: string;
  monto: number;
  moneda: string;
};

export type AnalisisCategoria = {
  categoria: string;
  tipo: string;
  moneda: string;
  total: number;
  cantidad: number;
};

export type Consejo = {
  tipo: string;
  titulo: string;
  texto: string;
};

export type DashboardResumen = {
  meta: DashboardMeta;
  kpis: ResumenKpis;
  desglose_ingresos: DesgloseIngreso[];
  categorias_ingreso: DesgloseIngreso[];
  costo_unitario: CostoUnitario[];
  tendencia: TendenciaMes[];
  proyeccion: ProyeccionMes[];
  semanal: SemanaMovimiento[];
  calor: Calor;
  transacciones: Transaccion[];
  analisis_categorias: AnalisisCategoria[];
  consejos: Consejo[];
};

export type ProduccionKpis = {
  pedidos_totales: number;
  libros_unicos: number;
  libros_con_un_pedido: number;
  libros_repetidos: number;
};

export type TopLibro = {
  titulo: string;
  autor: string;
  total: number;
};

export type RankingLibro = {
  titulo: string;
  autor: string;
  paginas: number;
  pedidos: number;
  clientes: number;
  ventas: number;
};

export type LibroReciente = {
  id: number;
  titulo: string;
  autor: string;
  fecha: string;
  pedidos: number;
  clientes: number;
};

export type PedidosMesSerie = {
  label: string;
  data: number[];
};

export type DashboardProduccion = {
  kpis: ProduccionKpis;
  top10_data: TopLibro[];
  ranking_data: RankingLibro[];
  recientes_data: LibroReciente[];
  pedidos_mes_data: {
    labels: string[];
    series: PedidosMesSerie[];
  };
};

export type ClientesKpis = {
  clientes_unicos_total: number;
  clientes_nuevos: number;
  clientes_recurrentes: number;
  clientes_vip: number;
  clientes_en_riesgo: number;
  promedio_pedidos: number;
};

export type TipoCliente = {
  tipo: string;
  total: number;
};

export type FrecuenciaData = {
  labels: string[];
  data: number[];
};

export type ClienteResumen = {
  id: number;
  nombre: string;
  telefono: string;
  pedidos: number;
  total_gastado: number;
  ultimo_pedido: string;
  dias_sin_comprar: number | null;
  tipo: string;
};

export type DashboardClientes = {
  kpis: ClientesKpis;
  tipo_cliente_data: TipoCliente[];
  frecuencia_data: FrecuenciaData;
  clientes_vip_lista: ClienteResumen[];
  clientes_riesgo_lista: ClienteResumen[];
};

export type DashboardData =
  | DashboardResumen
  | DashboardProduccion
  | DashboardClientes;

export const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "produccion", label: "Producción" },
  { id: "clientes", label: "Clientes" },
];

export function isDashboardTab(value: string | undefined): value is DashboardTab {
  return value === "resumen" || value === "produccion" || value === "clientes";
}

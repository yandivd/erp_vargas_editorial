export type ActivoFijo = {
  id: number;
  nombre: string;
  fecha_compra: string;
  valor_compra: number;
  vida_util_meses: number;
  valor_residual: number;
  total_depreciable: number;
  depreciacion_mensual: number;
  depreciacion_acumulada: number;
  valor_en_libros: number;
  meses_transcurridos: number;
  activo: boolean;
  estado_label: string;
};

export type ActivosResumen = {
  cantidad: number;
  cantidad_activos: number;
  total_valor_compra: number;
  total_depreciacion_mensual: number;
  total_depreciacion_acumulada: number;
  total_valor_en_libros: number;
};

export type ActivosData = {
  activos: ActivoFijo[];
  resumen: ActivosResumen;
};

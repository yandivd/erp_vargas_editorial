export type ParametrosCosto = {
  paginas_por_hoja: number;
  precio_papel_paquete: number;
  hojas_por_paquete: number;
  precio_tinta_litro: number;
  rinde_tinta_paginas: number;
  precio_pegamento: number;
  rinde_pegamento_lomos: number;
  esquineros_por_libro: number;
  costo_esquineros_material: number;
  precio_scotch: number;
  rinde_scotch_libros: number;
  precio_portada: number;
  paginas_para_grueso: number;
  precio_encuadernacion: number;
  precio_encuadernacion_grueso: number;
  electricidad_mensual: number;
  libros_por_mes_estimado: number;
  precio_diseno: number;
  paginas_min: number;
  paginas_max: number;
  margen_min: number;
  margen_max: number;
};

export type CostoCalculado = {
  hojas: number;
  costo_papel: number;
  costo_tinta: number;
  costo_pegamento: number;
  costo_scotch: number;
  costo_portada: number;
  costo_esquineros: number;
  costo_encuadernacion: number;
  costo_electricidad: number;
  costo_diseno: number;
  costo_total: number;
  paginas: number;
  precio_sugerido: number;
  anticipo_sugerido: number;
};

export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularCostoPorUnidad(
  paginas: number,
  llevaScotch: boolean,
  llevaEsquineros: boolean,
  parametros: ParametrosCosto,
): CostoCalculado {
  const paginasPorHoja = Math.trunc(parametros.paginas_por_hoja) || 1;
  const hojas = Math.floor((paginas + paginasPorHoja - 1) / paginasPorHoja);
  const costoPapel =
    hojas *
    (parametros.hojas_por_paquete
      ? parametros.precio_papel_paquete / parametros.hojas_por_paquete
      : 0);
  const costoTinta =
    paginas *
    (parametros.rinde_tinta_paginas
      ? parametros.precio_tinta_litro / parametros.rinde_tinta_paginas
      : 0);
  const costoPegamento = parametros.rinde_pegamento_lomos
    ? parametros.precio_pegamento / parametros.rinde_pegamento_lomos
    : 0;
  const costoEsquineros = llevaEsquineros
    ? parametros.esquineros_por_libro * parametros.costo_esquineros_material
    : 0;
  const costoScotch =
    llevaScotch && parametros.rinde_scotch_libros
      ? parametros.precio_scotch / parametros.rinde_scotch_libros
      : 0;
  const costoPortada = parametros.precio_portada;
  const costoEncuadernacion =
    paginas > parametros.paginas_para_grueso
      ? parametros.precio_encuadernacion_grueso
      : parametros.precio_encuadernacion;
  const costoElectricidad = parametros.libros_por_mes_estimado
    ? parametros.electricidad_mensual / parametros.libros_por_mes_estimado
    : 0;
  const costoDiseno = parametros.precio_diseno;

  const costoTotal = redondear2(
    costoPapel +
      costoTinta +
      costoPegamento +
      costoScotch +
      costoEsquineros +
      costoPortada +
      costoEncuadernacion +
      costoElectricidad +
      costoDiseno,
  );

  const paginasMin = parametros.paginas_min;
  const paginasMax =
    parametros.paginas_max === paginasMin
      ? paginasMin + 1
      : parametros.paginas_max;
  const proporcion =
    (Math.min(Math.max(paginas, paginasMin), paginasMax) - paginasMin) /
    (paginasMax - paginasMin);
  const margen =
    parametros.margen_min +
    proporcion * (parametros.margen_max - parametros.margen_min);
  const precioSugerido = Math.ceil((costoTotal * (1 + margen)) / 100) * 100;

  return {
    hojas,
    costo_papel: redondear2(costoPapel),
    costo_tinta: redondear2(costoTinta),
    costo_pegamento: redondear2(costoPegamento),
    costo_scotch: redondear2(costoScotch),
    costo_portada: redondear2(costoPortada),
    costo_esquineros: redondear2(costoEsquineros),
    costo_encuadernacion: redondear2(costoEncuadernacion),
    costo_electricidad: redondear2(costoElectricidad),
    costo_diseno: redondear2(costoDiseno),
    costo_total: costoTotal,
    paginas,
    precio_sugerido: precioSugerido,
    anticipo_sugerido: redondear2(precioSugerido / 2),
  };
}

export type ParametrosCosto = {
  paginas_por_hoja: number;
  precio_papel_paquete: number;
  hojas_por_paquete: number;
  precio_tinta_litro: number;
  rinde_tinta_paginas: number;
  precio_pegamento: number;
  rinde_pegamento_lomos: number;
  esquineros_por_libro: number;
  esquineros_por_paquete: number;
  precio_esquineros_paquete_usd: number;
  precio_cantos_pintados: number;
  tasa_cambio: number;
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
  tasa_cambio: number;
  precio_sugerido_usd?: number;
};

export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function incrementoCantosTintados(precioBase: number): number {
  if (precioBase < 5000) return 3000;
  if (precioBase < 8000) return 4000;
  return 5000;
}

function incrementoEsquineros(precioBase: number): number {
  if (precioBase < 5000) return 300;
  if (precioBase < 8000) return 500;
  return 800;
}

export function calcularPrecioConAcabados(
  precioBase: number,
  llevaCantosTintados: boolean,
  llevaEsquineros: boolean,
): number {
  const esquineros = llevaEsquineros || llevaCantosTintados;
  const incremento = llevaCantosTintados
    ? incrementoCantosTintados(precioBase)
    : esquineros
      ? incrementoEsquineros(precioBase)
      : 0;
  return precioBase + incremento;
}

export function calcularCostoPorUnidad(
  paginas: number,
  llevaCantosTintados: boolean,
  llevaEsquineros: boolean,
  parametros: ParametrosCosto,
): CostoCalculado {
  const paginasPorHoja = Math.trunc(parametros.paginas_por_hoja) || 1;
  const hojas = Math.floor((paginas + paginasPorHoja - 1) / paginasPorHoja);
  const costoPapel = hojas * (parametros.hojas_por_paquete ? parametros.precio_papel_paquete / parametros.hojas_por_paquete : 0);
  const costoTinta = paginas * (parametros.rinde_tinta_paginas ? parametros.precio_tinta_litro / parametros.rinde_tinta_paginas : 0);
  const costoPegamento = parametros.rinde_pegamento_lomos ? parametros.precio_pegamento / parametros.rinde_pegamento_lomos : 0;
  const costoEsquinerosUsd = parametros.esquineros_por_paquete
    ? (parametros.precio_esquineros_paquete_usd / parametros.esquineros_por_paquete) * parametros.esquineros_por_libro
    : 0;
  const esquineros = llevaEsquineros || llevaCantosTintados;
  const costoEsquineros = esquineros ? costoEsquinerosUsd * (parametros.tasa_cambio || 1) : 0;
  const costoCantosTintados = llevaCantosTintados ? parametros.precio_cantos_pintados : 0;
  const costoPortada = parametros.precio_portada;
  const costoEncuadernacion = paginas > parametros.paginas_para_grueso ? parametros.precio_encuadernacion_grueso : parametros.precio_encuadernacion;
  const costoElectricidad = parametros.libros_por_mes_estimado ? parametros.electricidad_mensual / parametros.libros_por_mes_estimado : 0;
  const costoDiseno = parametros.precio_diseno;

  const costoTotal = redondear2(
    costoPapel + costoTinta + costoPegamento + costoCantosTintados + costoEsquineros +
    costoPortada + costoEncuadernacion + costoElectricidad + costoDiseno,
  );

  const paginasMin = parametros.paginas_min;
  const paginasMax = parametros.paginas_max === paginasMin ? paginasMin + 1 : parametros.paginas_max;
  const proporcion = (Math.min(Math.max(paginas, paginasMin), paginasMax) - paginasMin) / (paginasMax - paginasMin);
  const margen = parametros.margen_min + proporcion * (parametros.margen_max - parametros.margen_min);
  const costoBase = redondear2(costoTotal - costoCantosTintados - costoEsquineros);
  const precioBase = Math.ceil((costoBase * (1 + margen)) / 100) * 100;
  const incremento = llevaCantosTintados ? incrementoCantosTintados(precioBase) : esquineros ? incrementoEsquineros(precioBase) : 0;
  const precioSugerido = precioBase + incremento;
  const tasa = parametros.tasa_cambio || 1;
  const TASA_USD_FIJA = 930;
  const precioSugeridoUsd = Math.round((precioSugerido / TASA_USD_FIJA) * 10) / 10;

  return {
    hojas,
    costo_papel: redondear2(costoPapel),
    costo_tinta: redondear2(costoTinta),
    costo_pegamento: redondear2(costoPegamento),
    costo_scotch: redondear2(costoCantosTintados),
    costo_portada: redondear2(costoPortada),
    costo_esquineros: redondear2(costoEsquineros),
    costo_encuadernacion: redondear2(costoEncuadernacion),
    costo_electricidad: redondear2(costoElectricidad),
    costo_diseno: redondear2(costoDiseno),
    costo_total: costoTotal,
    paginas,
    precio_sugerido: precioSugerido,
    anticipo_sugerido: redondear2(precioSugerido / 2),
    tasa_cambio: tasa,
    precio_sugerido_usd: precioSugeridoUsd,
  };
}

import { MUNICIPIOS, PROVINCIAS } from "./lugares";

export const ARTEMISA_COSTO = 0;

export const COSTOS_MENSAJERIA_LA_HABANA: Record<string, number> = {
  "Arroyo Naranjo": 1500,
  Boyeros: 2375,
  "Centro Habana": 1250,
  Cerro: 1250,
  Cotorro: 1000,
  "Diez de Octubre": 1250,
  Guanabacoa: 2000,
  "Habana del Este": 2500,
  "Habana Vieja": 1250,
  "La Habana Vieja": 1250,
  "La Lisa": 2625,
  Marianao: 2000,
  Playa: 2125,
  Plaza: 1500,
  "Plaza de la Revolución": 1500,
  Regla: 1500,
  "San Miguel del Padrón": 1000,
};

export const COSTOS_MENSAJERIA_ARTEMISA: Record<string, number> = {
  ...Object.fromEntries(
    MUNICIPIOS.Artemisa.map((municipio) => [municipio, ARTEMISA_COSTO]),
  ),
  Artemisa: 0,
};

export const COSTOS_MENSAJERIA: Record<string, number> = {
  ...COSTOS_MENSAJERIA_LA_HABANA,
  ...COSTOS_MENSAJERIA_ARTEMISA,
};

export function normalizarMunicipio(valor: string): string {
  return valor
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COSTOS_NORMALIZADOS = new Map<string, number>();
const NOMBRES_NORMALIZADOS = new Map<string, string>();

for (const [municipio, costo] of Object.entries(COSTOS_MENSAJERIA)) {
  const clave = normalizarMunicipio(municipio);
  COSTOS_NORMALIZADOS.set(clave, costo);
  NOMBRES_NORMALIZADOS.set(clave, municipio);
}

const PROVINCIA_POR_MUNICIPIO = new Map<string, string>();

for (const provincia of PROVINCIAS) {
  for (const municipio of MUNICIPIOS[provincia]) {
    PROVINCIA_POR_MUNICIPIO.set(normalizarMunicipio(municipio), provincia);
  }
}

PROVINCIA_POR_MUNICIPIO.set(normalizarMunicipio("Habana Vieja"), "La Habana");
PROVINCIA_POR_MUNICIPIO.set(normalizarMunicipio("Plaza"), "La Habana");

const PROVINCIAS_NORMALIZADAS = new Set(
  PROVINCIAS.map((provincia) => normalizarMunicipio(provincia)),
);

export function municipioEnTexto(texto: string): string | null {
  const normalizado = normalizarMunicipio(texto);

  if (!normalizado) {
    return null;
  }

  const claves = Array.from(COSTOS_NORMALIZADOS.keys()).sort(
    (a, b) => b.length - a.length,
  );
  const coincidencias: string[] = [];

  for (const clave of claves) {
    const patron = new RegExp(
      `(^|[^a-z0-9])${clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
    );

    if (patron.test(normalizado)) {
      coincidencias.push(clave);
    }
  }

  for (const clave of coincidencias) {
    if (!PROVINCIAS_NORMALIZADAS.has(clave)) {
      return NOMBRES_NORMALIZADOS.get(clave) ?? null;
    }
  }

  return coincidencias.length > 0
    ? (NOMBRES_NORMALIZADOS.get(coincidencias[0]) ?? null)
    : null;
}

export function provinciaDeMunicipio(municipio: string): string {
  const clave = normalizarMunicipio(municipio);

  if (!clave) {
    return "";
  }

  const directa = PROVINCIA_POR_MUNICIPIO.get(clave);

  if (directa) {
    return directa;
  }

  const coincidente = municipioEnTexto(clave);

  return coincidente
    ? (PROVINCIA_POR_MUNICIPIO.get(normalizarMunicipio(coincidente)) ?? "")
    : "";
}

let _tarifasOverride: Record<string, number> | null = null;

export function setTarifasMensajeria(tarifas: { municipio: string; costo: number }[]) {
  _tarifasOverride = {};
  for (const t of tarifas) _tarifasOverride[normalizarMunicipio(t.municipio)] = Number(t.costo || 0);
}

export function costoMensajeriaDe(
  municipio: string,
  provincia?: string,
): number {
  const clave = normalizarMunicipio(municipio);
  if (!clave) return 0;
  if (_tarifasOverride) {
    const ov = _tarifasOverride[clave];
    if (ov !== undefined) return ov;
    const coincidente = municipioEnTexto(clave);
    if (coincidente) {
      const ov2 = _tarifasOverride[normalizarMunicipio(coincidente)];
      if (ov2 !== undefined) return ov2;
    }
  }

  const directo = COSTOS_NORMALIZADOS.get(clave);
  if (directo !== undefined) return directo;

  const coincidente = municipioEnTexto(clave);
  if (coincidente) {
    const costo = COSTOS_NORMALIZADOS.get(normalizarMunicipio(coincidente));
    if (costo !== undefined) return costo;
  }

  if (normalizarMunicipio(provincia ?? "") === "artemisa") return ARTEMISA_COSTO;
  return 0;
}

export function costoMensajeriaDesdeTexto(
  texto: string,
  provincia?: string,
): number {
  const municipio = municipioEnTexto(texto);

  if (municipio) {
    return costoMensajeriaDe(
      municipio,
      provincia ?? provinciaDeMunicipio(municipio),
    );
  }

  return normalizarMunicipio(provincia ?? "") === "artemisa"
    ? ARTEMISA_COSTO
    : 0;
}

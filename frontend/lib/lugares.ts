export const PROVINCIAS = ["Artemisa", "La Habana"] as const;

export type Provincia = (typeof PROVINCIAS)[number];

export const MUNICIPIOS: Record<Provincia, string[]> = {
  Artemisa: [
    "Alquízar",
    "Artemisa",
    "Bahía Honda",
    "Bauta",
    "Caimito",
    "Candelaria",
    "Guanajay",
    "Güira de Melena",
    "Mariel",
    "San Antonio de los Baños",
    "San Cristóbal",
  ],
  "La Habana": [
    "Arroyo Naranjo",
    "Boyeros",
    "Centro Habana",
    "Cerro",
    "Cotorro",
    "Diez de Octubre",
    "Guanabacoa",
    "Habana del Este",
    "La Habana Vieja",
    "La Lisa",
    "Marianao",
    "Playa",
    "Plaza de la Revolución",
    "Regla",
    "San Miguel del Padrón",
  ],
};

export function municipiosDe(provincia: string): string[] {
  if (provincia === "Artemisa" || provincia === "La Habana") {
    return MUNICIPIOS[provincia];
  }

  return [];
}

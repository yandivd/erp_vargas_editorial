export type TemaDecoracion = "navidad" | "halloween" | "ninguno";

export const TEMAS_DECORACION: TemaDecoracion[] = ["navidad", "halloween", "ninguno"];

export function normalizarTemaDecoracion(valor: unknown): TemaDecoracion {
  return valor === "halloween" || valor === "ninguno" || valor === "navidad"
    ? valor
    : "navidad";
}

export type DecoracionConfig = {
  tema: TemaDecoracion;
  label: string;
  banner: string;
  backgroundImage: string;
  leftImage?: string;
  rightImage?: string;
  bottomImage?: string;
  accentClass: string;
};

export const DECORACIONES: Record<TemaDecoracion, DecoracionConfig | null> = {
  navidad: {
    tema: "navidad",
    label: "Navidad",
    banner: "🎄 ¡Felices Fiestas! 🎁",
    backgroundImage:
      "url('/img/navidad/stars.svg'), linear-gradient(to bottom, #020617 0%, #0f172a 55%, #020617 100%)",
    leftImage: "/img/navidad/pine-left.svg",
    rightImage: "/img/navidad/pine-right.svg",
    bottomImage: "/img/navidad/snow-bottom.svg",
    accentClass: "from-amber-200 via-yellow-50 to-amber-200",
  },
  halloween: {
    tema: "halloween",
    label: "Halloween",
    banner: "🎃 ¡Feliz Halloween! 👻",
    backgroundImage:
      "radial-gradient(circle at top, rgba(251,146,60,0.12), transparent 35%), linear-gradient(to bottom, #0b0614 0%, #1a1025 55%, #09040f 100%)",
    accentClass: "from-orange-300 via-amber-100 to-orange-300",
  },
  ninguno: null,
};

export async function fetchDecoracionTema(signal?: AbortSignal): Promise<TemaDecoracion> {
  try {
    const res = await fetch("/api/catalogo/decoracion", { signal, cache: "no-store", headers: { Accept: "application/json" } });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) return "navidad";
    return normalizarTemaDecoracion(payload.data?.tema);
  } catch {
    return "navidad";
  }
}

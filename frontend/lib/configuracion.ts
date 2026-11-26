import { apiFetch } from "@/lib/api";

export type ParametroAdmin = {
  clave: string;
  valor: number;
  descripcion: string;
  fecha_actualizacion: string;
};

export type ParametroEditable = {
  clave: string;
  valor: string;
  descripcion: string;
};

export type BannerAdmin = {
  id: number;
  titulo: string;
  imagen: string;
  imagen_url: string;
  activo: boolean;
  orden: number;
};

export type BannerInput = {
  titulo: string;
  imagen_url: string;
  activo: boolean;
  orden: string;
};

export type TemaCatalogo = "navidad" | "halloween" | "ninguno";

export async function fetchParametros(): Promise<ParametroAdmin[]> {
  const data = await apiFetch<{ parametros: ParametroAdmin[] }>("configuracion/parametros/");
  return data.parametros ?? [];
}

export async function guardarParametros(
  parametros: ParametroEditable[],
): Promise<string[]> {
  const data = await apiFetch<{ guardados: string[] }>("configuracion/parametros/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parametros }),
  });
  return data.guardados ?? [];
}

export async function fetchBannersAdmin(): Promise<BannerAdmin[]> {
  const data = await apiFetch<{ banners: BannerAdmin[] }>("configuracion/banners/?todos=1");
  return data.banners ?? [];
}

export async function crearBanner(banner: BannerInput): Promise<BannerAdmin> {
  const data = await apiFetch<{ banner: BannerAdmin }>("configuracion/banners/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(banner),
  });
  return data.banner;
}

export async function guardarBanner(id: number, banner: BannerInput): Promise<BannerAdmin> {
  const data = await apiFetch<{ banner: BannerAdmin }>(`configuracion/banners/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(banner),
  });
  return data.banner;
}

export async function eliminarBanner(id: number): Promise<void> {
  await apiFetch(`configuracion/banners/${id}/`, { method: "DELETE" });
}

export async function fetchTemaCatalogo(): Promise<TemaCatalogo> {
  const data = await apiFetch<{ tema: TemaCatalogo }>("configuracion/decoracion/");
  return ["navidad", "halloween", "ninguno"].includes(data.tema) ? data.tema : "navidad";
}

export async function guardarTemaCatalogo(tema: TemaCatalogo): Promise<void> {
  await apiFetch("configuracion/decoracion/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tema }),
  });
}

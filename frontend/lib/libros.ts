export const LIBRO_IMAGEN_DEFAULT = "/static/img/libro_default.jpg";

export type Libro = {
  id: number;
  titulo: string;
  autor: string;
  paginas: number;
  precio: string;
  imagen: string | null;
  imagen_base?: string | null;
  imagen_con_esquineros?: string | null;
  imagen_con_cantos?: string | null;
};

export function normalizarUrlImagen(url: string): string {
  const valor = url.trim();

  const drive =
    valor.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) ??
    valor.match(/drive\.google\.com\/open\?id=([^&#]+)/) ??
    valor.match(/drive\.google\.com\/thumbnail\?id=([^&#]+)/);

  if (drive) {
    return `https://lh3.googleusercontent.com/d/${drive[1]}`;
  }

  if (/dropbox\.com\//i.test(valor)) {
    try {
      const parsed = new URL(valor);
      parsed.hostname = "dl.dropboxusercontent.com";
      parsed.searchParams.set("raw", "1");
      parsed.searchParams.delete("dl");
      return parsed.toString();
    } catch {
      return valor;
    }
  }

  return valor;
}

export function libroImagenSrc(
  imagen?: string | null,
  imagenBase?: string | null,
): string {
  const url = imagenBase?.trim() || imagen?.trim();
  return url ? normalizarUrlImagen(url) : LIBRO_IMAGEN_DEFAULT;
}

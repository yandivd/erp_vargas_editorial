export const LIBRO_IMAGEN_DEFAULT = "/static/img/libro_default.jpg";

export function libroImagenSrc(imagen?: string | null): string {
  return imagen?.trim() ? imagen : LIBRO_IMAGEN_DEFAULT;
}

export type Libro = {
  id: number;
  titulo: string;
  autor: string;
  paginas: number;
  precio: string;
  imagen: string | null;
};

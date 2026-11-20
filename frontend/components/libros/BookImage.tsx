/* eslint-disable @next/next/no-img-element */
import { libroImagenSrc, normalizarUrlImagen } from "@/lib/libros";

type DatosImagenLibro = {
  titulo: string;
  imagen?: string | null;
  imagen_base?: string | null;
  imagen_con_esquineros?: string | null;
  imagen_con_cantos?: string | null;
};

type BookImageProps = {
  libro: DatosImagenLibro;
  llevaEsquineros?: boolean;
  llevaCantosTintados?: boolean;
  className?: string;
  imgClassName?: string;
  alt?: string;
  loading?: "lazy" | "eager";
};

export default function BookImage({
  libro,
  llevaEsquineros = false,
  llevaCantosTintados = false,
  className = "",
  imgClassName = "h-full w-full object-cover",
  alt,
  loading = "lazy",
}: BookImageProps) {
  const capas: string[] = [];

  if (llevaEsquineros && libro.imagen_con_esquineros?.trim()) {
    capas.push(normalizarUrlImagen(libro.imagen_con_esquineros));
  }

  if (llevaCantosTintados && libro.imagen_con_cantos?.trim()) {
    capas.push(normalizarUrlImagen(libro.imagen_con_cantos));
  }

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      <img
        src={libroImagenSrc(libro.imagen, libro.imagen_base)}
        alt={alt ?? `Portada de ${libro.titulo}`}
        loading={loading}
        decoding="async"
        className={`absolute inset-0 ${imgClassName}`}
      />
      {capas.map((src, indice) => (
        <img
          key={`${src}-${indice}`}
          src={src}
          alt=""
          aria-hidden="true"
          loading={loading}
          decoding="async"
          className={imgClassName}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
}

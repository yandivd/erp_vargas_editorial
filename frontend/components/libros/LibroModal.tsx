"use client";

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import DesgloseCostos from "@/components/ui/DesgloseCostos";
import { apiFetch } from "@/lib/api";
import {
  calcularCostoPorUnidad,
  type ParametrosCosto,
} from "@/lib/costos";
import { money } from "@/lib/format";
import type { Libro } from "@/lib/libros";

type LibroModalProps = {
  libro?: Libro;
};

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export default function LibroModal({ libro }: LibroModalProps) {
  const router = useRouter();
  const esEdicion = Boolean(libro);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [paginas, setPaginas] = useState("");
  const [precio, setPrecio] = useState("");
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreviewUrl, setImagenPreviewUrl] = useState<string | null>(null);
  const [parametros, setParametros] = useState<ParametrosCosto | null>(null);
  const [parametrosError, setParametrosError] = useState<string | null>(null);
  const [precioManual, setPrecioManual] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const paginasNumero = Number(paginas);
  const calculo = useMemo(() => {
    if (
      !parametros ||
      !Number.isFinite(paginasNumero) ||
      paginasNumero <= 0
    ) {
      return null;
    }

    return calcularCostoPorUnidad(
      Math.trunc(paginasNumero),
      false,
      false,
      parametros,
    );
  }, [parametros, paginasNumero]);
  const precioEfectivo =
    !precioManual && calculo ? String(calculo.precio_sugerido) : precio;

  useEffect(() => {
    if (!abierto || parametros) {
      return;
    }

    let cancelado = false;

    apiFetch<{ parametros: ParametrosCosto }>("libros/parametros-costo/")
      .then((data) => {
        if (!cancelado) {
          setParametros(data.parametros);
          setParametrosError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelado) {
          setParametrosError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudieron cargar los parámetros de costo.",
          );
        }
      });

    return () => {
      cancelado = true;
    };
  }, [abierto, parametros]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAbierto(false);
        setError(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [abierto, guardando]);

  function abrir() {
    setTitulo(libro?.titulo ?? "");
    setAutor(libro?.autor ?? "");
    setPaginas(libro ? String(libro.paginas) : "");
    setPrecio(libro?.precio ?? "");
    setPrecioManual(esEdicion);
    setImagenFile(null);
    setImagenPreviewUrl(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setError(null);
    setExito(null);
    setAbierto(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function cerrar() {
    if (guardando) {
      return;
    }
    setAbierto(false);
    setError(null);
  }

  function handlePaginasChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setPaginas(value);

    if (!precioManual && !value.trim()) {
      setPrecio("");
    }
  }

  function handleImagenChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImagenFile(file);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (file) {
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setImagenPreviewUrl(url);
    } else {
      setImagenPreviewUrl(null);
    }
  }

  function usarPrecioSugerido() {
    if (!calculo) {
      return;
    }
    setPrecio(String(calculo.precio_sugerido));
    setPrecioManual(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) {
      return;
    }

    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }

    const paginasValor = Number(paginas);
    if (
      !Number.isInteger(paginasValor) ||
      paginasValor <= 0
    ) {
      setError("Las páginas deben ser un número entero mayor que cero.");
      return;
    }

    const precioValor = Number(precioEfectivo);
    if (!Number.isFinite(precioValor) || precioValor < 0) {
      setError("El precio debe ser un número mayor o igual que cero.");
      return;
    }

    setGuardando(true);
    setError(null);

    const formData = new FormData();
    formData.set("titulo", titulo.trim());
    formData.set("autor", autor.trim());
    formData.set("paginas", String(paginasValor));
    formData.set("precio", String(precioValor));
    if (imagenFile) {
      formData.set("imagen", imagenFile);
    }

    try {
      const endpoint = esEdicion ? `libros/${libro?.id}/` : "libros/";
      const method = esEdicion ? "PATCH" : "POST";
      const guardado = await apiFetch<Libro>(endpoint, {
        method,
        body: formData,
      });

      setAbierto(false);
      if (!esEdicion) {
        setExito(`Libro "${guardado.titulo}" registrado.`);
      }
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar el libro.",
      );
    } finally {
      setGuardando(false);
    }
  }

  const previewSrc = imagenPreviewUrl ?? libro?.imagen ?? null;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={
          esEdicion
            ? "inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
            : "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
        }
      >
        {esEdicion ? (
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
        {esEdicion ? "Editar" : "Nuevo Libro"}
      </button>

      {exito ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{exito}</span>
        </div>
      ) : null}

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cerrar();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="libro-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="libro-modal-title"
                  className="text-lg font-extrabold text-ink"
                >
                  {esEdicion ? "Editar Libro" : "Nuevo Libro"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {esEdicion
                    ? "Actualiza los datos y la portada del libro."
                    : "Registra el libro y calcula su precio sugerido."}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrar}
                disabled={guardando}
                className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {error ? (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="libro-titulo" className={labelClass}>
                    Título *
                  </label>
                  <input
                    id="libro-titulo"
                    type="text"
                    value={titulo}
                    onChange={(event) => setTitulo(event.target.value)}
                    disabled={guardando}
                    required
                    autoFocus
                    className={inputClass}
                    placeholder="Título del libro"
                  />
                </div>

                <div>
                  <label htmlFor="libro-autor" className={labelClass}>
                    Autor
                  </label>
                  <input
                    id="libro-autor"
                    type="text"
                    value={autor}
                    onChange={(event) => setAutor(event.target.value)}
                    disabled={guardando}
                    className={inputClass}
                    placeholder="Autor del libro"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="libro-paginas" className={labelClass}>
                    Páginas *
                  </label>
                  <input
                    id="libro-paginas"
                    type="number"
                    min={1}
                    step={1}
                    value={paginas}
                    onChange={handlePaginasChange}
                    disabled={guardando}
                    required
                    className={inputClass}
                    placeholder="Ej. 320"
                  />
                </div>

                <div>
                  <label htmlFor="libro-precio" className={labelClass}>
                    Precio *
                  </label>
                  <input
                    id="libro-precio"
                    type="number"
                    min={0}
                    step="0.01"
                    value={precioEfectivo}
                    onChange={(event) => {
                      setPrecio(event.target.value);
                      setPrecioManual(true);
                    }}
                    disabled={guardando}
                    required
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="libro-imagen" className={labelClass}>
                  Imagen
                </label>
                <div className="flex items-start gap-3">
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-slate-50">
                    {previewSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewSrc}
                        alt="Vista previa de la portada"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen
                        className="h-6 w-6 text-slate-300"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="libro-imagen"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50"
                    >
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                      Seleccionar imagen
                    </label>
                    <input
                      ref={fileInputRef}
                      id="libro-imagen"
                      type="file"
                      accept="image/*"
                      onChange={handleImagenChange}
                      disabled={guardando}
                      className="sr-only"
                    />
                    <p className="mt-1 text-xs text-muted">
                      {imagenFile
                        ? imagenFile.name
                        : "JPG, PNG o WebP. Opcional."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
                {calculo ? (
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        Costo total de producción {money(calculo.costo_total)} +
                        margen por {calculo.paginas} páginas ={" "}
                        <strong>{money(calculo.precio_sugerido)}</strong>
                      </span>
                      {precioManual ? (
                        <button
                          type="button"
                          onClick={usarPrecioSugerido}
                          className="self-start font-semibold underline underline-offset-2 sm:self-auto"
                        >
                          Usar precio sugerido
                        </button>
                      ) : null}
                    </div>
                    <DesgloseCostos
                      costo={calculo}
                      className="border-t border-blue-200 pt-2 text-blue-800"
                    />
                  </div>
                ) : parametrosError ? (
                  <span className="text-red-700">{parametrosError}</span>
                ) : (
                  <span>
                    Escribe la cantidad de páginas para calcular el precio
                    sugerido.
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cerrar}
                  disabled={guardando}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {guardando
                    ? "Guardando..."
                    : esEdicion
                      ? "Guardar cambios"
                      : "Crear libro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

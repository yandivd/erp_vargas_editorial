"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, ListFilter, Save, Trash2 } from "lucide-react";
import {
  crearBanner,
  eliminarBanner,
  fetchBannersAdmin,
  fetchParametros,
  fetchTemaCatalogo,
  guardarBanner,
  guardarParametros,
  guardarTemaCatalogo,
  type BannerAdmin,
  type ParametroEditable,
  type TemaCatalogo,
} from "@/lib/configuracion";

type Seccion = "parametros" | "banners" | "tema";

type BorradorBanner = {
  titulo: string;
  activo: boolean;
  orden: string;
  imagen: File | null;
};

const PARAMETROS_SUGERIDOS: { clave: string; descripcion: string }[] = [
  { clave: "paginas_por_hoja", descripcion: "Páginas por hoja" },
  { clave: "hojas_por_paquete", descripcion: "Hojas por paquete" },
  { clave: "paginas_para_grueso", descripcion: "Páginas para considerar grueso" },
  { clave: "paginas_min", descripcion: "Mínimo de páginas" },
  { clave: "paginas_max", descripcion: "Máximo de páginas" },
  { clave: "margen_min", descripcion: "Margen mínimo" },
  { clave: "margen_max", descripcion: "Margen máximo" },
  { clave: "libros_por_mes_estimado", descripcion: "Libros estimados por mes" },
  { clave: "rinde_tinta_paginas", descripcion: "Rinde de tinta en páginas" },
  { clave: "rinde_pegamento_lomos", descripcion: "Rinde de pegamento en lomos" },
  { clave: "esquineros_por_libro", descripcion: "Esquineros por libro" },
  { clave: "esquineros_por_paquete", descripcion: "Esquineros por paquete" },
  { clave: "precio_papel_paquete_usd", descripcion: "Precio papel paquete USD" },
  { clave: "precio_tinta_litro_usd", descripcion: "Precio tinta por litro USD" },
  { clave: "precio_pegamento_usd", descripcion: "Precio pegamento USD" },
  { clave: "precio_esquineros_paquete_usd", descripcion: "Precio esquineros paquete USD" },
  { clave: "precio_cantos_pintados_usd", descripcion: "Precio cantos pintados USD" },
  { clave: "precio_portada_usd", descripcion: "Precio portada USD" },
  { clave: "precio_encuadernacion_usd", descripcion: "Encuadernación USD" },
  { clave: "precio_encuadernacion_grueso_usd", descripcion: "Encuadernación grueso USD" },
  { clave: "electricidad_mensual_usd", descripcion: "Electricidad mensual USD" },
  { clave: "precio_diseno_usd", descripcion: "Diseño USD" },
  { clave: "Tasa_cambio", descripcion: "Tasa de cambio CUP por USD" },
  { clave: "precio_papel_paquete", descripcion: "Precio papel paquete CUP (legacy)" },
  { clave: "precio_tinta_litro", descripcion: "Precio tinta litro CUP (legacy)" },
  { clave: "precio_pegamento", descripcion: "Precio pegamento CUP (legacy)" },
  { clave: "precio_cantos_pintados", descripcion: "Cantos pintados CUP (legacy)" },
  { clave: "precio_portada", descripcion: "Portada CUP (legacy)" },
  { clave: "precio_encuadernacion", descripcion: "Encuadernación CUP (legacy)" },
  { clave: "precio_encuadernacion_grueso", descripcion: "Encuadernación grueso CUP (legacy)" },
  { clave: "electricidad_mensual", descripcion: "Electricidad mensual CUP (legacy)" },
  { clave: "precio_diseno", descripcion: "Diseño CUP (legacy)" },
];

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function borradorDe(banner: BannerAdmin): BorradorBanner {
  return {
    titulo: banner.titulo,
    activo: banner.activo,
    orden: String(banner.orden),
    imagen: null,
  };
}

function datosBanner(borrador: BorradorBanner): FormData {
  const form = new FormData();
  form.set("titulo", borrador.titulo);
  form.set("activo", borrador.activo ? "true" : "false");
  form.set("orden", borrador.orden || "0");
  if (borrador.imagen) {
    form.set("imagen", borrador.imagen);
  }
  return form;
}

export default function ConfiguracionClient() {
  const router = useRouter();
  const [seccion, setSeccion] = useState<Seccion>("parametros");
  const [parametros, setParametros] = useState<ParametroEditable[]>([]);
  const [banners, setBanners] = useState<BannerAdmin[]>([]);
  const [borradores, setBorradores] = useState<Record<number, BorradorBanner>>({});
  const [nuevoBanner, setNuevoBanner] = useState<BorradorBanner>({
    titulo: "",
    activo: true,
    orden: "0",
    imagen: null,
  });
  const [tema, setTema] = useState<TemaCatalogo>("navidad");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [parametrosData, bannersData, temaData] = await Promise.all([
        fetchParametros(),
        fetchBannersAdmin(),
        fetchTemaCatalogo(),
      ]);
      const existentes = new Map(parametrosData.map((item) => [item.clave, item]));
      const claves = new Set([
        ...PARAMETROS_SUGERIDOS.map((item) => item.clave),
        ...parametrosData.map((item) => item.clave),
      ]);
      const combinados = Array.from(claves).map((clave) => {
        const sugerido = PARAMETROS_SUGERIDOS.find((item) => item.clave === clave);
        const actual = existentes.get(clave);
        return {
          clave,
          valor: actual ? String(actual.valor) : "",
          descripcion: actual?.descripcion || sugerido?.descripcion || "",
        };
      });
      setParametros(combinados);
      setBanners(bannersData);
      setBorradores(
        Object.fromEntries(bannersData.map((banner) => [banner.id, borradorDe(banner)])),
      );
      setTema(temaData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar la configuración.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void cargar());
  }, [cargar]);

  function mensajeError(requestError: unknown, fallback: string) {
    setError(requestError instanceof Error ? requestError.message : fallback);
  }

  async function guardarParametrosForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const validos = parametros.filter(
        (item) => item.clave.trim() !== "" && item.valor.trim() !== "",
      );
      if (validos.some((item) => Number.isNaN(Number(item.valor)))) {
        throw new Error("Revisa los valores numéricos de los parámetros.");
      }
      const guardados = await guardarParametros(validos);
      setMensaje(`Se guardaron ${guardados.length} parámetros.`);
      router.refresh();
    } catch (requestError) {
      mensajeError(requestError, "No se pudieron guardar los parámetros.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarBannerActual(id: number) {
    const borrador = borradores[id];
    if (!borrador) return;
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await guardarBanner(id, datosBanner(borrador));
      setMensaje("Banner actualizado.");
      await cargar();
      router.refresh();
    } catch (requestError) {
      mensajeError(requestError, "No se pudo guardar el banner.");
    } finally {
      setGuardando(false);
    }
  }

  async function crearBannerActual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nuevoBanner.imagen) {
      setError("Selecciona una imagen para el banner.");
      return;
    }
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await crearBanner(datosBanner(nuevoBanner));
      setNuevoBanner({ titulo: "", activo: true, orden: "0", imagen: null });
      setMensaje("Banner creado.");
      await cargar();
      router.refresh();
    } catch (requestError) {
      mensajeError(requestError, "No se pudo crear el banner.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarBannerActual(id: number) {
    if (!window.confirm("¿Eliminar este banner?")) return;
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await eliminarBanner(id);
      setMensaje("Banner eliminado.");
      await cargar();
      router.refresh();
    } catch (requestError) {
      mensajeError(requestError, "No se pudo eliminar el banner.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarTemaActual() {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await guardarTemaCatalogo(tema);
      setMensaje("Tema del catálogo actualizado.");
      router.refresh();
    } catch (requestError) {
      mensajeError(requestError, "No se pudo actualizar el tema.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink">Configuración</h1>
        <p className="mt-1 text-sm text-muted">
          Administra parámetros, banners y decoración sin entrar al admin de Django.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { id: "parametros", label: "Parámetros" },
          { id: "banners", label: "Banners" },
          { id: "tema", label: "Decoración" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSeccion(item.id as Seccion)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${seccion === item.id ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:bg-slate-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mensaje ? (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{mensaje}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {cargando ? (
        <p className="rounded-xl border border-line bg-white p-6 text-sm text-muted">Cargando configuración...</p>
      ) : null}

      {!cargando && seccion === "parametros" ? (
        <form onSubmit={guardarParametrosForm} className="rounded-xl border border-line bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><ListFilter className="h-5 w-5" />Parámetros de negocio</h2>
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              <Save className="h-4 w-4" />Guardar cambios
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted">
                  <th className="border-b border-line px-2 py-2">Clave</th>
                  <th className="border-b border-line px-2 py-2">Descripción</th>
                  <th className="border-b border-line px-2 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {parametros.map((parametro, index) => (
                  <tr key={parametro.clave}>
                    <td className="border-b border-line px-2 py-2 font-mono text-xs text-ink">{parametro.clave}</td>
                    <td className="border-b border-line px-2 py-2">
                      <input
                        className={inputClass}
                        value={parametro.descripcion}
                        onChange={(event) => {
                          setParametros((prev) => prev.map((item, i) => (i === index ? { ...item, descripcion: event.target.value } : item)));
                        }}
                      />
                    </td>
                    <td className="border-b border-line px-2 py-2">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={parametro.valor}
                        placeholder="Sin valor"
                        onChange={(event) => {
                          setParametros((prev) => prev.map((item, i) => (i === index ? { ...item, valor: event.target.value } : item)));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setParametros((prev) => [...prev, { clave: "", valor: "", descripcion: "" }])}
            className="mt-4 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
          >
            Agregar parámetro
          </button>
        </form>
      ) : null}

      {!cargando && seccion === "banners" ? (
        <div className="space-y-5">
          {banners.map((banner) => {
            const borrador = borradores[banner.id] ?? borradorDe(banner);
            return (
              <section key={banner.id} className="rounded-xl border border-line bg-white p-4 shadow-sm md:p-6">
                <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div
                    className="h-32 rounded-lg border border-line bg-cover bg-center"
                    style={{ backgroundImage: `url(${JSON.stringify(banner.imagen || "/img/catalogo/banner-1.png")})` }}
                    aria-label={`Vista previa de ${banner.titulo || `banner ${banner.id}`}`}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                      Título
                      <input
                        className={inputClass}
                        value={borrador.titulo}
                        onChange={(event) => setBorradores((prev) => ({ ...prev, [banner.id]: { ...borrador, titulo: event.target.value } }))}
                      />
                    </label>
                    <label className="text-sm font-semibold text-ink">
                      Orden
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={borrador.orden}
                        onChange={(event) => setBorradores((prev) => ({ ...prev, [banner.id]: { ...borrador, orden: event.target.value } }))}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={borrador.activo}
                        onChange={(event) => setBorradores((prev) => ({ ...prev, [banner.id]: { ...borrador, activo: event.target.checked } }))}
                      />
                      Activo
                    </label>
                    <label className="text-sm font-semibold text-ink">
                      Reemplazar imagen
                      <input
                        type="file"
                        accept="image/*"
                        className={inputClass}
                        onChange={(event) => setBorradores((prev) => ({ ...prev, [banner.id]: { ...borrador, imagen: event.target.files?.[0] ?? null } }))}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => void guardarBannerActual(banner.id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />Guardar
                      </button>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => void eliminarBannerActual(banner.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          <form onSubmit={crearBannerActual} className="rounded-xl border border-line bg-white p-4 shadow-sm md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink"><ImageIcon className="h-5 w-5" />Nuevo banner</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-ink">
                Título
                <input
                  className={inputClass}
                  value={nuevoBanner.titulo}
                  onChange={(event) => setNuevoBanner((prev) => ({ ...prev, titulo: event.target.value }))}
                />
              </label>
              <label className="text-sm font-semibold text-ink">
                Orden
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={nuevoBanner.orden}
                  onChange={(event) => setNuevoBanner((prev) => ({ ...prev, orden: event.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={nuevoBanner.activo}
                  onChange={(event) => setNuevoBanner((prev) => ({ ...prev, activo: event.target.checked }))}
                />
                Activo
              </label>
              <label className="text-sm font-semibold text-ink">
                Imagen
                <input
                  type="file"
                  accept="image/*"
                  className={inputClass}
                  onChange={(event) => setNuevoBanner((prev) => ({ ...prev, imagen: event.target.files?.[0] ?? null }))}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={guardando}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              <ImageIcon className="h-4 w-4" />Agregar banner
            </button>
          </form>
        </div>
      ) : null}

      {!cargando && seccion === "tema" ? (
        <section className="rounded-xl border border-line bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-4 text-lg font-bold text-ink">Decoración del catálogo</h2>
          <label className="block max-w-sm text-sm font-semibold text-ink">
            Tema visual
            <select
              className={inputClass}
              value={tema}
              onChange={(event) => setTema(event.target.value as TemaCatalogo)}
            >
              <option value="navidad">Navidad</option>
              <option value="halloween">Halloween</option>
              <option value="ninguno">Sin decoración</option>
            </select>
          </label>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardarTemaActual()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            <Save className="h-4 w-4" />Guardar tema
          </button>
        </section>
      ) : null}
    </div>
  );
}

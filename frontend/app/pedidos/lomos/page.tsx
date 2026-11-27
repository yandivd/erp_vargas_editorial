"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  History,
  Loader2,
  Ruler,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";

type LineaLomo = {
  original: string;
  referencia: number;
  medida_original: string;
  nueva_medida: string;
  asterisco: string;
  titulo: string;
  encontrado: boolean;
  resultado: string;
};

type ResultadoLomos = {
  lineas: LineaLomo[];
  resultado: string;
  procesadas: number;
  omitidas: number;
};

type RegistroHistorialLomo = {
  id: number;
  referencia_externa: number;
  titulo: string;
  medida_original: string;
  nueva_medida: string;
  asterisco: boolean;
  veces: number;
  fecha: string;
  ultima_fecha: string;
  usuario: string;
};

type HistorialLomos = {
  registros: RegistroHistorialLomo[];
};

export default function LomosPage() {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoLomos | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<RegistroHistorialLomo[]>([]);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  const cargarHistorial = useCallback(async () => {
    try {
      const datos = await apiFetch<HistorialLomos>("pedidos/historial-lomos");
      setHistorial(datos.registros);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el historial.",
      );
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void cargarHistorial();
    });
  }, [cargarHistorial]);

  const historialFiltrado = useMemo(() => {
    const termino = busquedaHistorial.trim().toLowerCase();

    if (!termino) {
      return historial;
    }

    return historial.filter(
      (registro) =>
        String(registro.referencia_externa).includes(termino) ||
        registro.titulo.toLowerCase().includes(termino),
    );
  }, [historial, busquedaHistorial]);

  async function handleProcesar() {
    setProcesando(true);
    setError(null);
    setCopiado(false);
    setResultado(null);

    try {
      const datos = await apiFetch<ResultadoLomos>(
        "pedidos/procesar-lomos",
        {
          method: "POST",
          body: JSON.stringify({ texto }),
        },
      );
      setResultado(datos);
      await cargarHistorial();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo procesar el mensaje.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function handleCopiar() {
    if (!resultado?.resultado) {
      return;
    }

    try {
      await navigator.clipboard.writeText(resultado.resultado);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al dashboard
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
              <Ruler className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Medidas de lomo
              </h1>
              <p className="text-sm text-gray-600">
                Convierte el mensaje del encuadernador en una lista lista para
                enviar por WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Mensaje original</h2>
          <p className="mt-1 text-sm text-gray-600">
            Una línea por libro, en formato <code>ID-MEDIDA</code>. El asterisco
            se conserva al final del resultado.
          </p>
          <textarea
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder={"636-0.8\n639-3.4*"}
            rows={14}
            className="mt-4 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-500">
              Se suman 0.4 cm a todas las medidas.
            </span>
            <button
              type="button"
              onClick={handleProcesar}
              disabled={procesando || !texto.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {procesando && <Loader2 className="h-4 w-4 animate-spin" />}
              Procesar
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Resultado</h2>
              {resultado && (
                <p className="text-xs text-gray-500">
                  {resultado.procesadas} líneas procesadas
                  {resultado.omitidas > 0 &&
                    ` · ${resultado.omitidas} omitidas`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCopiar}
              disabled={!resultado?.resultado}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copiado ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiado ? "Copiado" : "Copiar al portapapeles"}
            </button>
          </div>

          <pre className="mt-4 min-h-64 w-full whitespace-pre-wrap break-words rounded-lg bg-gray-900 p-4 font-mono text-sm leading-6 text-gray-100">
            {resultado?.resultado ||
              "Los resultados aparecerán aquí después de procesar."}
          </pre>

          {resultado && resultado.lineas.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {resultado.lineas.map((linea, indice) => (
                <li
                  key={`${linea.referencia}-${indice}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-gray-900">
                    {linea.referencia}
                  </span>
                  <span
                    className={
                      linea.encontrado
                        ? "text-gray-700"
                        : "text-amber-700"
                    }
                  >
                    {linea.titulo}
                  </span>
                  <span className="font-mono text-xs text-gray-600">
                    {linea.medida_original} → {linea.nueva_medida} cm
                    {linea.asterisco}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <History className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Historial de lomos
              </h2>
              <p className="text-sm text-gray-600">
                Consulta si la portada ya existe y con qué medidas quedó.
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={busquedaHistorial}
              onChange={(evento) => setBusquedaHistorial(evento.target.value)}
              placeholder="Buscar por ID o título"
              className="w-64 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {cargandoHistorial ? (
          <p className="mt-4 text-sm text-gray-500">Cargando historial…</p>
        ) : historialFiltrado.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            {historial.length === 0
              ? "Todavía no hay medidas registradas."
              : "No hay registros que coincidan con la búsqueda."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Última medida</th>
                  <th className="px-3 py-2">Medida original</th>
                  <th className="px-3 py-2">Veces</th>
                  <th className="px-3 py-2">Registrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historialFiltrado.map((registro) => (
                  <tr key={registro.id}>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {registro.referencia_externa}
                    </td>
                    <td
                      className={`px-3 py-2 ${
                        registro.titulo === "No encontrado"
                          ? "text-amber-700"
                          : "text-gray-700"
                      }`}
                    >
                      {registro.titulo}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-900">
                      {registro.nueva_medida} cm
                      {registro.asterisco ? " *" : ""}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">
                      {registro.medida_original} cm
                    </td>
                    <td className="px-3 py-2 text-gray-700">{registro.veces}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {registro.ultima_fecha}
                      {registro.usuario ? ` · ${registro.usuario}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

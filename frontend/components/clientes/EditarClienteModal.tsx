"use client";

import { AlertCircle, CheckCircle2, Loader2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import type { ClienteListItem } from "@/lib/clientes";
import { PROVINCIAS, municipiosDe } from "@/lib/lugares";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export default function EditarClienteModal({ cliente }: { cliente: ClienteListItem }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(cliente.nombre);
  const [telefono, setTelefono] = useState(cliente.telefono || "");
  const [direccion, setDireccion] = useState(cliente.direccion || "");
  const [provincia, setProvincia] = useState(cliente.provincia || "");
  const [municipio, setMunicipio] = useState(cliente.municipio || "");
  const [notas, setNotas] = useState(cliente.notas || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const municipios = municipiosDe(provincia);
  const fid = `editar-cliente-${cliente.id}`;

  useEffect(() => {
    if (!abierto) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !guardando) { setAbierto(false); setError(null); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [abierto, guardando]);

  function abrir() {
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono || "");
    setDireccion(cliente.direccion || "");
    setProvincia(cliente.provincia || "");
    setMunicipio(cliente.municipio || "");
    setNotas(cliente.notas || "");
    setError(null);
    setExito(null);
    setAbierto(true);
  }

  function cerrar() {
    if (guardando) return;
    setAbierto(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return; }

    setGuardando(true);
    setError(null);
    try {
      const actualizado = await apiFetch<ClienteListItem>(`clientes/${cliente.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          provincia,
          municipio,
          notas: notas.trim(),
        }),
      });
      setAbierto(false);
      setExito(`Cliente "${actualizado.nombre}" actualizado.`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo actualizar el cliente.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Editar
      </button>

      {exito ? (
        <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{exito}</span>
        </div>
      ) : null}

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) cerrar(); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby={`${fid}-title`} className="my-auto w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id={`${fid}-title`} className="text-lg font-extrabold text-ink">Editar Cliente</h2>
                <p className="mt-1 text-sm text-muted">Actualiza los datos del cliente.</p>
              </div>
              <button type="button" onClick={cerrar} disabled={guardando} className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed" aria-label="Cerrar">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {error ? (
              <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor={`${fid}-nombre`} className={labelClass}>Nombre *</label>
                <input id={`${fid}-nombre`} type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={guardando} required autoFocus className={inputClass} />
              </div>
              <div>
                <label htmlFor={`${fid}-telefono`} className={labelClass}>Teléfono</label>
                <input id={`${fid}-telefono`} type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} disabled={guardando} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`${fid}-direccion`} className={labelClass}>Dirección</label>
                <input id={`${fid}-direccion`} type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} disabled={guardando} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${fid}-provincia`} className={labelClass}>Provincia</label>
                  <select id={`${fid}-provincia`} value={provincia} onChange={(e) => { setProvincia(e.target.value); setMunicipio(""); }} disabled={guardando} className={inputClass}>
                    <option value="">Sin especificar</option>
                    {PROVINCIAS.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${fid}-municipio`} className={labelClass}>Municipio</label>
                  <select id={`${fid}-municipio`} value={municipio} onChange={(e) => setMunicipio(e.target.value)} disabled={guardando || !provincia} className={inputClass}>
                    <option value="">Sin especificar</option>
                    {municipios.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor={`${fid}-notas`} className={labelClass}>Notas</label>
                <textarea id={`${fid}-notas`} value={notas} onChange={(e) => setNotas(e.target.value)} disabled={guardando} rows={3} className={inputClass} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={cerrar} disabled={guardando} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed">Cancelar</button>
                <button type="submit" disabled={guardando} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

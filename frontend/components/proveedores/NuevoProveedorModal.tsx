"use client";

import { AlertCircle, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import {
  TIPOS_PROVEEDOR,
  type Proveedor,
  type ProveedorTipo,
} from "@/lib/proveedores";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export default function NuevoProveedorModal() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<ProveedorTipo>("IMPRENTA_PORTADA");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !guardando) {
        setAbierto(false);
        setError(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [abierto, guardando]);

  function abrir() {
    setNombre("");
    setTipo("IMPRENTA_PORTADA");
    setTelefono("");
    setDireccion("");
    setNotas("");
    setError(null);
    setExito(null);
    setAbierto(true);
  }

  function cerrar() {
    if (guardando) {
      return;
    }
    setAbierto(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) {
      return;
    }

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const proveedor = await apiFetch<Proveedor>("proveedores/", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo,
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          notas: notas.trim(),
        }),
      });

      setAbierto(false);
      setExito(`Proveedor "${proveedor.nombre}" registrado.`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el proveedor.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Nuevo Proveedor
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
            aria-labelledby="nuevo-proveedor-modal-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="nuevo-proveedor-modal-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Nuevo Proveedor
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Registra los datos de contacto del proveedor.
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
              <div>
                <label htmlFor="proveedor-form-nombre" className={labelClass}>
                  Nombre *
                </label>
                <input
                  id="proveedor-form-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  disabled={guardando}
                  required
                  autoFocus
                  className={inputClass}
                  placeholder="Nombre del proveedor"
                />
              </div>

              <div>
                <label htmlFor="proveedor-form-tipo" className={labelClass}>
                  Tipo *
                </label>
                <select
                  id="proveedor-form-tipo"
                  value={tipo}
                  onChange={(event) =>
                    setTipo(event.target.value as ProveedorTipo)
                  }
                  disabled={guardando}
                  className={inputClass}
                >
                  {TIPOS_PROVEEDOR.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="proveedor-form-telefono" className={labelClass}>
                  Teléfono
                </label>
                <input
                  id="proveedor-form-telefono"
                  type="text"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  disabled={guardando}
                  className={inputClass}
                  placeholder="Ej. +53 5555 5555"
                />
              </div>

              <div>
                <label htmlFor="proveedor-form-direccion" className={labelClass}>
                  Dirección
                </label>
                <input
                  id="proveedor-form-direccion"
                  type="text"
                  value={direccion}
                  onChange={(event) => setDireccion(event.target.value)}
                  disabled={guardando}
                  className={inputClass}
                  placeholder="Dirección del proveedor"
                />
              </div>

              <div>
                <label htmlFor="proveedor-form-notas" className={labelClass}>
                  Notas
                </label>
                <textarea
                  id="proveedor-form-notas"
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  disabled={guardando}
                  rows={3}
                  className={inputClass}
                  placeholder="Notas internas (opcional)"
                />
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
                  {guardando ? "Guardando..." : "Crear proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

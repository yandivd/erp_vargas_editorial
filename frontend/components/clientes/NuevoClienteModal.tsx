"use client";

import { AlertCircle, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import type { ClienteListItem } from "@/lib/clientes";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export default function NuevoClienteModal() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
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
      const cliente = await apiFetch<ClienteListItem>("clientes/", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          notas: notas.trim(),
        }),
      });

      setAbierto(false);
      setExito(`Cliente "${cliente.nombre}" registrado.`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el cliente.",
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
        Nuevo Cliente
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
            aria-labelledby="nuevo-cliente-modal-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="nuevo-cliente-modal-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Nuevo Cliente
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Registra los datos de contacto del cliente.
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
                <label htmlFor="cliente-form-nombre" className={labelClass}>
                  Nombre *
                </label>
                <input
                  id="cliente-form-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  disabled={guardando}
                  required
                  autoFocus
                  className={inputClass}
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label htmlFor="cliente-form-telefono" className={labelClass}>
                  Teléfono
                </label>
                <input
                  id="cliente-form-telefono"
                  type="text"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  disabled={guardando}
                  className={inputClass}
                  placeholder="Ej. +53 5555 5555"
                />
              </div>

              <div>
                <label htmlFor="cliente-form-direccion" className={labelClass}>
                  Dirección
                </label>
                <input
                  id="cliente-form-direccion"
                  type="text"
                  value={direccion}
                  onChange={(event) => setDireccion(event.target.value)}
                  disabled={guardando}
                  className={inputClass}
                  placeholder="Dirección de entrega"
                />
              </div>

              <div>
                <label htmlFor="cliente-form-notas" className={labelClass}>
                  Notas
                </label>
                <textarea
                  id="cliente-form-notas"
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
                  {guardando ? "Guardando..." : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

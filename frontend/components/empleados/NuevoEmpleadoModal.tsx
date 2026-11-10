"use client";

import { AlertCircle, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import {
  CARGOS_EMPLEADO,
  type Empleado,
  type EmpleadoCargo,
} from "@/lib/empleados";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export default function NuevoEmpleadoModal() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState<EmpleadoCargo>("OPERARIO");
  const [telefono, setTelefono] = useState("");
  const [salarioBase, setSalarioBase] = useState("");
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
    setCargo("OPERARIO");
    setTelefono("");
    setSalarioBase("");
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

    const salario = Number(salarioBase);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!Number.isFinite(salario) || salario < 0) {
      setError("El salario base debe ser un número válido.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const empleado = await apiFetch<Empleado>("empleados/", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          cargo,
          telefono: telefono.trim(),
          salario_base: salario,
          activo: true,
        }),
      });

      setAbierto(false);
      setExito(`Empleado "${empleado.nombre}" registrado.`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el empleado.",
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
        Nuevo Empleado
      </button>

      {exito ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
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
            aria-labelledby="nuevo-empleado-modal-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="nuevo-empleado-modal-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Nuevo Empleado
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Registra los datos del empleado y su salario base.
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
                <label htmlFor="empleado-form-nombre" className={labelClass}>
                  Nombre *
                </label>
                <input
                  id="empleado-form-nombre"
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
                <label htmlFor="empleado-form-cargo" className={labelClass}>
                  Cargo *
                </label>
                <select
                  id="empleado-form-cargo"
                  value={cargo}
                  onChange={(event) =>
                    setCargo(event.target.value as EmpleadoCargo)
                  }
                  disabled={guardando}
                  className={inputClass}
                >
                  {CARGOS_EMPLEADO.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="empleado-form-telefono" className={labelClass}>
                  Teléfono
                </label>
                <input
                  id="empleado-form-telefono"
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  disabled={guardando}
                  className={inputClass}
                  placeholder="Teléfono de contacto"
                />
              </div>

              <div>
                <label htmlFor="empleado-form-salario" className={labelClass}>
                  Salario base (CUP)
                </label>
                <input
                  id="empleado-form-salario"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={salarioBase}
                  onChange={(event) => setSalarioBase(event.target.value)}
                  disabled={guardando}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-4">
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
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {guardando ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

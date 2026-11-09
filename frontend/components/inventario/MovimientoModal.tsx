"use client";

import { AlertCircle, Loader2, PackagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { number } from "@/lib/format";
import type {
  InventarioMaterial,
  InventarioMovimientoResponse,
} from "@/lib/inventario";

type MovimientoModalProps = {
  materiales: InventarioMaterial[];
};

type ProveedorInventario = {
  id: number;
  nombre: string;
  tipo_label?: string;
};

export default function MovimientoModal({
  materiales,
}: MovimientoModalProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [tipo, setTipo] = useState<"ENTRADA" | "SALIDA">("ENTRADA");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("0");
  const [proveedorId, setProveedorId] = useState("");
  const [proveedores, setProveedores] = useState<ProveedorInventario[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const material = materiales.find((item) => item.id === Number(materialId)) ?? null;
  const cantidadNumero = Number(cantidad);
  const cantidadValida =
    Number.isFinite(cantidadNumero) && cantidadNumero > 0;

  useEffect(() => {
    if (!abierto) {
      return;
    }

    let cancelado = false;

    async function cargarProveedores() {
      try {
        const response = await apiFetch<{ proveedores: ProveedorInventario[] }>(
          "proveedores/?per_page=100",
        );

        if (!cancelado) {
          setProveedores(response.proveedores);
        }
      } catch {
        if (!cancelado) {
          setProveedores([]);
        }
      }
    }

    void cargarProveedores();

    return () => {
      cancelado = true;
    };
  }, [abierto]);

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
    setMaterialId("");
    setTipo("ENTRADA");
    setCantidad("1");
    setMotivo("");
    setCostoUnitario("0");
    setProveedorId("");
    setProveedores([]);
    setGuardando(false);
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

    if (!material) {
      setError("Selecciona un material.");
      return;
    }

    if (!cantidadValida) {
      setError("La cantidad debe ser mayor a cero.");
      return;
    }

    if (tipo === "SALIDA" && cantidadNumero > material.stock_actual) {
      setError("La cantidad no puede superar el stock actual.");
      return;
    }

    const costoUnitarioNumero = Number(costoUnitario || 0);
    const proveedorIdNumero =
      tipo === "ENTRADA" ? (proveedorId ? Number(proveedorId) : null) : null;

    if (
      tipo === "ENTRADA" &&
      (!Number.isFinite(costoUnitarioNumero) || costoUnitarioNumero < 0)
    ) {
      setError("El costo unitario debe ser un número mayor o igual a cero.");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch<InventarioMovimientoResponse["data"]>(
        "inventario/movimiento/",
        {
          method: "POST",
          body: JSON.stringify({
            material_id: material.id,
            tipo,
            cantidad: cantidadNumero,
            motivo: motivo.trim(),
            costo_unitario: tipo === "ENTRADA" ? costoUnitarioNumero : 0,
            proveedor_id: tipo === "ENTRADA" ? proveedorIdNumero : null,
          }),
        },
      );

      setAbierto(false);
      setExito("Movimiento registrado.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar el movimiento.",
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
        <PackagePlus className="h-4 w-4" aria-hidden="true" />
        Registrar Movimiento
      </button>

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
            aria-labelledby="registrar-movimiento-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="registrar-movimiento-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Registrar movimiento
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Entradas y salidas de material.
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

            {exito ? (
              <div
                role="status"
                className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                <span className="mt-0.5 text-sm font-semibold">
                  {exito}
                </span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="inventario-movimiento-material"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Material *
                </label>
                <select
                  id="inventario-movimiento-material"
                  value={materialId}
                  onChange={(event) => setMaterialId(event.target.value)}
                  disabled={guardando}
                  required
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                >
                  <option value="">Selecciona un material...</option>
                  {materiales.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.nombre} ({number(item.stock_actual)} {item.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="inventario-movimiento-tipo"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Tipo *
                  </label>
                  <select
                    id="inventario-movimiento-tipo"
                    value={tipo}
                    onChange={(event) => {
                      const nuevoTipo = event.target.value as
                        | "ENTRADA"
                        | "SALIDA";
                      setTipo(nuevoTipo);

                      if (nuevoTipo === "SALIDA") {
                        setCostoUnitario("0");
                        setProveedorId("");
                      }
                    }}
                    disabled={guardando}
                    required
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                  >
                    <option value="ENTRADA">Entrada</option>
                    <option value="SALIDA">Salida</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="inventario-movimiento-cantidad"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Cantidad *
                  </label>
                  <input
                    id="inventario-movimiento-cantidad"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={cantidad}
                    onChange={(event) => setCantidad(event.target.value)}
                    disabled={guardando}
                    required
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="inventario-movimiento-motivo"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Motivo
                </label>
                <input
                  id="inventario-movimiento-motivo"
                  type="text"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  disabled={guardando}
                  placeholder="Motivo del movimiento"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                />
              </div>

              {tipo === "ENTRADA" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="inventario-movimiento-costo"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Costo Unitario
                    </label>
                    <input
                      id="inventario-movimiento-costo"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={costoUnitario}
                      onChange={(event) => setCostoUnitario(event.target.value)}
                      disabled={guardando}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="inventario-movimiento-proveedor"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Proveedor (opcional)
                    </label>
                    <select
                      id="inventario-movimiento-proveedor"
                      value={proveedorId}
                      onChange={(event) => setProveedorId(event.target.value)}
                      disabled={guardando}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50"
                    >
                      <option value="">Selecciona un proveedor (opcional)...</option>
                      {proveedores.map((proveedor) => (
                        <option key={proveedor.id} value={String(proveedor.id)}>
                          {proveedor.nombre}
                          {proveedor.tipo_label ? ` (${proveedor.tipo_label})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

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
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  )}
                  {guardando ? "Registrando..." : "Registrar movimiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

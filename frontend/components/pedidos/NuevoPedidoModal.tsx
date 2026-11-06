"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  Loader2,
  Plus,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import SelectBuscador, {
  type SelectBuscadorOption,
} from "@/components/ui/SelectBuscador";
import { apiFetch } from "@/lib/api";
import {
  calcularCostoPorUnidad,
  redondear2,
  type CostoCalculado,
  type ParametrosCosto,
} from "@/lib/costos";
import { integer, money, number } from "@/lib/format";

type Cliente = {
  id: number;
  nombre: string;
  telefono: string;
};

type Libro = {
  id: number;
  titulo: string;
  autor: string;
  paginas: number;
  precio: string;
};

type CodigoDescuento = {
  id: number;
  codigo: string;
  porcentaje: number;
  descripcion: string;
  categoria: string;
};

type DescuentoValidado = {
  porcentaje: number;
  descuento: number;
  precio_final: number;
  descripcion: string;
};

type PedidoCreado = {
  pedido: {
    id: number;
  };
};

type ModoCliente = "existente" | "nuevo";
type ModoLibro = "existente" | "nuevo";
type MonedaAnticipo = "CUP" | "USD";

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido.";
}

export default function NuevoPedidoModal() {
  const router = useRouter();

  const [abierto, setAbierto] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [libros, setLibros] = useState<Libro[]>([]);
  const [codigos, setCodigos] = useState<CodigoDescuento[]>([]);
  const [parametros, setParametros] = useState<ParametrosCosto | null>(null);
  const [catalogosError, setCatalogosError] = useState<string | null>(null);

  const [modoCliente, setModoCliente] = useState<ModoCliente>("existente");
  const [clienteId, setClienteId] = useState("");
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState("");
  const [nuevoClienteDireccion, setNuevoClienteDireccion] = useState("");

  const [modoLibro, setModoLibro] = useState<ModoLibro>("existente");
  const [libroId, setLibroId] = useState("");
  const [libroSeleccionado, setLibroSeleccionado] = useState<Libro | null>(null);
  const [nuevoLibroTitulo, setNuevoLibroTitulo] = useState("");
  const [nuevoLibroAutor, setNuevoLibroAutor] = useState("");
  const [libroPaginas, setLibroPaginas] = useState("");

  const [cantidad, setCantidad] = useState("1");
  const [llevaScotch, setLlevaScotch] = useState(false);
  const [llevaEsquineros, setLlevaEsquineros] = useState(false);
  const [precioVenta, setPrecioVenta] = useState("0");
  const [anticipoRequerido, setAnticipoRequerido] = useState("0");
  const [monedaAnticipo, setMonedaAnticipo] = useState<MonedaAnticipo>("CUP");
  const [tasaCambio, setTasaCambio] = useState<number | null>(null);
  const [tasaError, setTasaError] = useState<string | null>(null);
  const [notas, setNotas] = useState("");

  const [codigoDescuento, setCodigoDescuento] = useState("");
  const [descuentoAplicado, setDescuentoAplicado] = useState("0");
  const [descuentoActivo, setDescuentoActivo] = useState(false);
  const [descuentoInfo, setDescuentoInfo] = useState<string | null>(null);
  const [descuentoError, setDescuentoError] = useState<string | null>(null);
  const [precioOriginal, setPrecioOriginal] = useState<string | null>(null);
  const [anticipoOriginal, setAnticipoOriginal] = useState<string | null>(null);

  const [precioEditadoManualmente, setPrecioEditadoManualmente] = useState(false);
  const [anticipoEditado, setAnticipoEditado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const clienteOptions = useMemo<SelectBuscadorOption[]>(
    () =>
      clientes.map((cliente) => ({
        value: String(cliente.id),
        label: `${cliente.nombre}${
          cliente.telefono ? ` — ${cliente.telefono}` : ""
        }`,
      })),
    [clientes],
  );

  const libroOptions = useMemo<SelectBuscadorOption[]>(
    () =>
      libros.map((libro) => ({
        value: String(libro.id),
        label: `${libro.titulo}${libro.autor ? ` — ${libro.autor}` : ""}`,
      })),
    [libros],
  );

  const codigoOptions = useMemo<SelectBuscadorOption[]>(
    () =>
      codigos.map((codigo) => ({
        value: codigo.codigo,
        label: `${codigo.codigo} — ${codigo.porcentaje}%${
          codigo.descripcion ? ` — ${codigo.descripcion}` : ""
        }`,
      })),
    [codigos],
  );

  const clienteSeleccionado = useMemo(
    () => clienteOptions.find((option) => option.value === clienteId) ?? null,
    [clienteOptions, clienteId],
  );

  const libroOptionSeleccionada = useMemo(
    () => libroOptions.find((option) => option.value === libroId) ?? null,
    [libroOptions, libroId],
  );

  const codigoSeleccionado = useMemo(
    () =>
      codigoOptions.find((option) => option.value === codigoDescuento) ?? null,
    [codigoOptions, codigoDescuento],
  );

  const cargarTasaCambio = useCallback(async () => {
    try {
      const data = await apiFetch<{ tasa_cambio: number }>(
        "pedidos/tasa-cambio/",
      );
      const valor = Number(data.tasa_cambio);
      if (!Number.isFinite(valor) || valor <= 0) {
        throw new Error("La tasa de cambio recibida no es válida.");
      }
      setTasaCambio(valor);
      setTasaError(null);
    } catch (error) {
      setTasaCambio(null);
      setTasaError(mensajeError(error));
    }
  }, []);

  const cargarCatalogos = useCallback(async () => {
    void cargarTasaCambio();
    try {
      const [clientesResult, librosResult, codigosResult, parametrosResult] =
        await Promise.all([
          apiFetch<Cliente[]>("clientes/"),
          apiFetch<Libro[]>("libros/"),
          apiFetch<{ codigos: CodigoDescuento[] }>(
            "pedidos/codigos-vigentes/",
          ),
          apiFetch<{ parametros: ParametrosCosto }>(
            "pedidos/parametros-costo/",
          ),
        ]);
      setCatalogosError(null);
      setClientes(clientesResult);
      setLibros(librosResult);
      setCodigos(codigosResult.codigos);
      setParametros(parametrosResult.parametros);
    } catch (error) {
      setCatalogosError(mensajeError(error));
    }
  }, [cargarTasaCambio]);

  useEffect(() => {
    let cancelado = false;

    Promise.all([
      apiFetch<Cliente[]>("clientes/"),
      apiFetch<Libro[]>("libros/"),
      apiFetch<{ codigos: CodigoDescuento[] }>("pedidos/codigos-vigentes/"),
      apiFetch<{ parametros: ParametrosCosto }>(
        "pedidos/parametros-costo/",
      ),
    ])
      .then(([clientesResult, librosResult, codigosResult, parametrosResult]) => {
        if (cancelado) {
          return;
        }
        setCatalogosError(null);
        setClientes(clientesResult);
        setLibros(librosResult);
        setCodigos(codigosResult.codigos);
        setParametros(parametrosResult.parametros);
      })
      .catch((error: unknown) => {
        if (!cancelado) {
          setCatalogosError(mensajeError(error));
        }
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function manejarTecla(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAbierto(false);
      }
    }

    window.addEventListener("keydown", manejarTecla);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", manejarTecla);
    };
  }, [abierto]);

  const paginas =
    modoLibro === "nuevo"
      ? Number(libroPaginas)
      : Number(libroSeleccionado?.paginas ?? 0);

  const costo = useMemo(() => {
    if (!parametros || !Number.isFinite(paginas) || paginas <= 0) {
      return null;
    }
    return calcularCostoPorUnidad(
      paginas,
      llevaScotch,
      llevaEsquineros,
      parametros,
    );
  }, [parametros, paginas, llevaScotch, llevaEsquineros]);

  const cantidadNum = Math.max(1, Number(cantidad) || 1);
  const precio = Number(precioVenta || 0);
  const esAnticipoUsd = monedaAnticipo === "USD";
  const tasaValida =
    tasaCambio !== null && Number.isFinite(tasaCambio) && tasaCambio > 0;
  const anticipo = Number(anticipoRequerido || 0);
  const anticipoEnCup = redondear2(
    esAnticipoUsd ? anticipo * (tasaCambio ?? 0) : anticipo,
  );
  const saldo = redondear2(Math.max(0, precio - anticipoEnCup));
  const vuelto = redondear2(Math.max(0, anticipoEnCup - precio));
  const precioEnUsd = tasaValida ? precio / (tasaCambio ?? 1) : 0;
  const costoTotalPedido = costo
    ? redondear2(costo.costo_total * cantidadNum)
    : 0;
  const ganancia = redondear2(precio - costoTotalPedido);

  function anticipoSugeridoEnMoneda(montoCup: number): string {
    if (monedaAnticipo === "USD") {
      const tasa = tasaCambio ?? 0;
      return tasa > 0 ? String(Math.floor(montoCup / tasa)) : "0";
    }
    return String(redondear2(montoCup));
  }

  function calcularActual(
    paginasActuales: number,
    scotch: boolean,
    esquineros: boolean,
  ): CostoCalculado | null {
    if (
      !parametros ||
      !Number.isFinite(paginasActuales) ||
      paginasActuales <= 0
    ) {
      return null;
    }
    return calcularCostoPorUnidad(
      paginasActuales,
      scotch,
      esquineros,
      parametros,
    );
  }

  function abrirModal() {
    setAbierto(true);
    setSubmitError(null);
    setDescuentoError(null);
    void cargarCatalogos();
  }

  function cerrarModal() {
    if (!saving) {
      setAbierto(false);
    }
  }

  function limpiarFormulario() {
    setModoCliente("existente");
    setClienteId("");
    setNuevoClienteNombre("");
    setNuevoClienteTelefono("");
    setNuevoClienteDireccion("");
    setModoLibro("existente");
    setLibroId("");
    setLibroSeleccionado(null);
    setNuevoLibroTitulo("");
    setNuevoLibroAutor("");
    setLibroPaginas("");
    setCantidad("1");
    setLlevaScotch(false);
    setLlevaEsquineros(false);
    setPrecioVenta("0");
    setAnticipoRequerido("0");
    setMonedaAnticipo("CUP");
    setNotas("");
    setCodigoDescuento("");
    setDescuentoAplicado("0");
    setDescuentoActivo(false);
    setDescuentoInfo(null);
    setDescuentoError(null);
    setPrecioOriginal(null);
    setAnticipoOriginal(null);
    setPrecioEditadoManualmente(false);
    setAnticipoEditado(false);
    setSubmitError(null);
  }

  function resetDescuento() {
    setCodigoDescuento("");
    setDescuentoAplicado("0");
    setDescuentoActivo(false);
    setDescuentoInfo(null);
    setDescuentoError(null);

    if (precioOriginal !== null) {
      setPrecioVenta(precioOriginal);
    }
    if (anticipoOriginal !== null) {
      setAnticipoRequerido(anticipoOriginal);
    }

    setPrecioOriginal(null);
    setAnticipoOriginal(null);
    setPrecioEditadoManualmente(false);
    setAnticipoEditado(false);
  }

  function handleClienteChange(value: string) {
    setClienteId(value);
  }

  function handleModoClienteExistente() {
    setModoCliente("existente");
  }

  function handleModoClienteNuevo() {
    setModoCliente("nuevo");
  }

  function handleLibroChange(value: string) {
    const libro = libros.find((item) => String(item.id) === value) ?? null;
    setLibroId(value);
    setModoLibro("existente");
    setLibroSeleccionado(libro);
    resetDescuento();

    if (libro) {
      setPrecioVenta(String(libro.precio));
      setAnticipoRequerido(anticipoSugeridoEnMoneda(Number(libro.precio) / 2));
      setPrecioEditadoManualmente(false);
      setAnticipoEditado(false);
    } else {
      setPrecioVenta("0");
      setAnticipoRequerido("0");
      setPrecioEditadoManualmente(false);
      setAnticipoEditado(false);
    }
  }

  function handleModoLibroExistente() {
    setModoLibro("existente");
    const libro =
      libros.find((item) => String(item.id) === libroId) ?? null;
    setLibroSeleccionado(libro);
    resetDescuento();

    if (libro) {
      setPrecioVenta(String(libro.precio));
      setAnticipoRequerido(anticipoSugeridoEnMoneda(Number(libro.precio) / 2));
      setPrecioEditadoManualmente(false);
      setAnticipoEditado(false);
    } else {
      setPrecioVenta("0");
      setAnticipoRequerido("0");
      setPrecioEditadoManualmente(false);
      setAnticipoEditado(false);
    }
  }

  function handleModoLibroNuevo() {
    setModoLibro("nuevo");
    setPrecioEditadoManualmente(false);
    setAnticipoEditado(false);
    resetDescuento();

    const calculo = calcularActual(
      Number(libroPaginas),
      llevaScotch,
      llevaEsquineros,
    );
    if (calculo) {
      setPrecioVenta(String(calculo.precio_sugerido));
      setAnticipoRequerido(anticipoSugeridoEnMoneda(calculo.anticipo_sugerido));
    }
  }

  function handleLibroPaginasChange(value: string) {
    setModoLibro("nuevo");
    setLibroPaginas(value);
    setPrecioEditadoManualmente(false);
    setAnticipoEditado(false);
    resetDescuento();

    const calculo = calcularActual(
      Number(value),
      llevaScotch,
      llevaEsquineros,
    );
    if (calculo) {
      setPrecioVenta(String(calculo.precio_sugerido));
      setAnticipoRequerido(anticipoSugeridoEnMoneda(calculo.anticipo_sugerido));
    }
  }

  function handleScotchChange(checked: boolean) {
    setLlevaScotch(checked);

    if (modoLibro === "nuevo") {
      if (descuentoActivo) {
        resetDescuento();
      }
      const calculo = calcularActual(
        Number(libroPaginas),
        checked,
        llevaEsquineros,
      );
      if (calculo) {
        if (!precioEditadoManualmente) {
          setPrecioVenta(String(calculo.precio_sugerido));
        }
        if (!anticipoEditado) {
          setAnticipoRequerido(anticipoSugeridoEnMoneda(calculo.anticipo_sugerido));
        }
      }
    }
  }

  function handleEsquinerosChange(checked: boolean) {
    setLlevaEsquineros(checked);

    if (modoLibro === "nuevo") {
      if (descuentoActivo) {
        resetDescuento();
      }
      const calculo = calcularActual(
        Number(libroPaginas),
        llevaScotch,
        checked,
      );
      if (calculo) {
        if (!precioEditadoManualmente) {
          setPrecioVenta(String(calculo.precio_sugerido));
        }
        if (!anticipoEditado) {
          setAnticipoRequerido(anticipoSugeridoEnMoneda(calculo.anticipo_sugerido));
        }
      }
    }
  }

  function handlePrecioChange(value: string) {
    setPrecioVenta(value);
    setPrecioEditadoManualmente(true);
  }

  function handleAnticipoChange(value: string) {
    if (esAnticipoUsd && value !== "" && !/^\d+$/.test(value)) {
      return;
    }
    setAnticipoRequerido(value);
    setAnticipoEditado(true);
  }

  function handleMonedaAnticipoChange(next: MonedaAnticipo) {
    if (next === monedaAnticipo) {
      return;
    }

    const actual = Number(anticipoRequerido || 0);

    if (next === "USD") {
      const tasa = tasaCambio ?? 0;
      if (tasa > 0) {
        setAnticipoRequerido(String(Math.floor(actual / tasa)));
      } else {
        setAnticipoRequerido("0");
        void cargarTasaCambio();
      }
      setMonedaAnticipo("USD");
      return;
    }

    setAnticipoRequerido(
      String(redondear2(actual * (tasaCambio ?? 0))),
    );
    setMonedaAnticipo("CUP");
  }

  async function aplicarDescuento() {
    setDescuentoError(null);

    if (!codigoDescuento) {
      setDescuentoError("Selecciona un código de descuento.");
      return;
    }

    const precioActual = Number(precioVenta || 0);
    if (precioActual <= 0) {
      setDescuentoError("El precio de venta debe ser mayor a 0.");
      return;
    }

    const params = new URLSearchParams({
      codigo: codigoDescuento,
      precio: String(precioActual),
    });
    if (modoLibro === "existente" && libroId) {
      params.set("libro_id", libroId);
    }

    try {
      const descuento = await apiFetch<DescuentoValidado>(
        `pedidos/validar-descuento/?${params.toString()}`,
      );

      setDescuentoAplicado(String(descuento.descuento));
      setDescuentoActivo(true);
      setPrecioOriginal(precioVenta);
      setAnticipoOriginal(anticipoRequerido);
      setPrecioVenta(String(descuento.precio_final));
      setAnticipoRequerido(
        anticipoSugeridoEnMoneda(descuento.precio_final / 2),
      );
      setPrecioEditadoManualmente(true);
      setAnticipoEditado(true);
      setDescuentoInfo(
        `${descuento.descripcion || "Descuento aplicado"} — ${descuento.porcentaje}% — Precio final: ${money(
          descuento.precio_final,
        )}`,
      );
    } catch (error) {
      setDescuentoError(mensajeError(error));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    if (modoCliente === "existente" && !clienteId) {
      setSubmitError("Selecciona un cliente o cambia a cliente nuevo.");
      return;
    }
    if (modoCliente === "nuevo" && !nuevoClienteNombre.trim()) {
      setSubmitError("El cliente nuevo debe tener nombre.");
      return;
    }
    if (modoLibro === "existente" && !libroId) {
      setSubmitError("Selecciona un libro o cambia a libro nuevo.");
      return;
    }
    if (
      modoLibro === "nuevo" &&
      (!nuevoLibroTitulo.trim() || !Number(libroPaginas))
    ) {
      setSubmitError("Si creas un libro nuevo, indica título y páginas.");
      return;
    }
    if (!Number(precioVenta) || Number(precioVenta) <= 0) {
      setSubmitError("El precio de venta debe ser mayor a 0.");
      return;
    }
    if (!Number.isFinite(anticipo) || anticipo < 0) {
      setSubmitError("El anticipo debe ser un monto válido.");
      return;
    }
    if (esAnticipoUsd && !Number.isInteger(anticipo)) {
      setSubmitError("El anticipo en USD debe ser un monto entero.");
      return;
    }
    if (esAnticipoUsd && anticipo > 0 && !tasaValida) {
      setSubmitError("No hay una tasa de cambio válida para el anticipo en USD.");
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      await apiFetch<PedidoCreado>("pedidos/", {
        method: "POST",
        body: JSON.stringify({
          cliente_id: modoCliente === "nuevo" ? null : Number(clienteId),
          cliente_nombre:
            modoCliente === "nuevo" ? nuevoClienteNombre.trim() : "",
          cliente_telefono:
            modoCliente === "nuevo" ? nuevoClienteTelefono.trim() : "",
          cliente_direccion:
            modoCliente === "nuevo" ? nuevoClienteDireccion.trim() : "",
          libro_id: modoLibro === "nuevo" ? null : Number(libroId),
          libro_titulo:
            modoLibro === "nuevo" ? nuevoLibroTitulo.trim() : "",
          libro_autor: modoLibro === "nuevo" ? nuevoLibroAutor.trim() : "",
          libro_paginas:
            modoLibro === "nuevo" ? Number(libroPaginas) : null,
          cantidad: cantidadNum,
          lleva_scotch: llevaScotch,
          lleva_esquineros: llevaEsquineros,
          precio_venta: Number(precioVenta),
          anticipo_requerido: anticipoEnCup,
          monto_anticipo: anticipo,
          moneda_anticipo: monedaAnticipo,
          tasa_cambio: esAnticipoUsd ? tasaCambio : null,
          notas: notas.trim(),
          codigo_descuento: descuentoActivo ? codigoDescuento : "",
          descuento_aplicado: descuentoActivo
            ? Number(descuentoAplicado || 0)
            : 0,
        }),
      });

      limpiarFormulario();
      setAbierto(false);
      router.refresh();
    } catch (error) {
      setSubmitError(mensajeError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirModal}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Nuevo Pedido
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cerrarModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nuevo-pedido-title"
            className="my-2 w-full max-w-4xl rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
              <div>
                <h2
                  id="nuevo-pedido-title"
                  className="text-lg font-extrabold text-ink"
                >
                  Registrar Nuevo Pedido
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  La fecha de entrega se calcula automáticamente 28 días
                  después de crear el pedido.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                disabled={saving}
                className="rounded-lg p-2 text-muted transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {catalogosError ? (
              <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:mx-6">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{catalogosError}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="max-h-[calc(100vh-14rem)] space-y-5 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                <section className="space-y-3">
                  <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                    <UserRound
                      className="h-5 w-5 text-brand"
                      aria-hidden="true"
                    />
                    Cliente
                  </h3>

                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={handleModoClienteExistente}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        modoCliente === "existente"
                          ? "bg-white text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      Cliente Registrado
                    </button>
                    <button
                      type="button"
                      onClick={handleModoClienteNuevo}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        modoCliente === "nuevo"
                          ? "bg-white text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      Cliente Nuevo
                    </button>
                  </div>

                  {modoCliente === "existente" ? (
                    <div>
                      <label
                        htmlFor="cliente"
                        className="mb-1.5 block text-sm font-semibold text-ink"
                      >
                        Cliente
                      </label>
                      <SelectBuscador
                        inputId="cliente"
                        options={clienteOptions}
                        value={clienteSeleccionado}
                        onChange={(option) =>
                          handleClienteChange(option?.value ?? "")
                        }
                        placeholder="Buscar cliente por nombre o teléfono..."
                        isClearable
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="nuevo-cliente-nombre"
                          className="mb-1.5 block text-sm font-semibold text-ink"
                        >
                          Nombre completo *
                        </label>
                        <input
                          id="nuevo-cliente-nombre"
                          type="text"
                          value={nuevoClienteNombre}
                          onChange={(event) =>
                            setNuevoClienteNombre(event.target.value)
                          }
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="nuevo-cliente-telefono"
                          className="mb-1.5 block text-sm font-semibold text-ink"
                        >
                          Teléfono
                        </label>
                        <input
                          id="nuevo-cliente-telefono"
                          type="text"
                          value={nuevoClienteTelefono}
                          onChange={(event) =>
                            setNuevoClienteTelefono(event.target.value)
                          }
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="nuevo-cliente-direccion"
                          className="mb-1.5 block text-sm font-semibold text-ink"
                        >
                          Dirección
                        </label>
                        <input
                          id="nuevo-cliente-direccion"
                          type="text"
                          value={nuevoClienteDireccion}
                          onChange={(event) =>
                            setNuevoClienteDireccion(event.target.value)
                          }
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                    <BookOpen
                      className="h-5 w-5 text-brand"
                      aria-hidden="true"
                    />
                    Libro
                  </h3>

                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={handleModoLibroExistente}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        modoLibro === "existente"
                          ? "bg-white text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      Libro en Catálogo
                    </button>
                    <button
                      type="button"
                      onClick={handleModoLibroNuevo}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                        modoLibro === "nuevo"
                          ? "bg-white text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      Libro Nuevo
                    </button>
                  </div>

                  {modoLibro === "existente" ? (
                    <div>
                      <label
                        htmlFor="libro"
                        className="mb-1.5 block text-sm font-semibold text-ink"
                      >
                        Libro
                      </label>
                      <SelectBuscador
                        inputId="libro"
                        options={libroOptions}
                        value={libroOptionSeleccionada}
                        onChange={(option) =>
                          handleLibroChange(option?.value ?? "")
                        }
                        placeholder="Buscar libro por título o autor..."
                        isClearable
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="nuevo-libro-titulo"
                          className="mb-1.5 block text-sm font-semibold text-ink"
                        >
                          Título *
                        </label>
                        <input
                          id="nuevo-libro-titulo"
                          type="text"
                          value={nuevoLibroTitulo}
                          onChange={(event) =>
                            setNuevoLibroTitulo(event.target.value)
                          }
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="nuevo-libro-autor"
                          className="mb-1.5 block text-sm font-semibold text-ink"
                        >
                          Autor
                        </label>
                        <input
                          id="nuevo-libro-autor"
                          type="text"
                          value={nuevoLibroAutor}
                          onChange={(event) =>
                            setNuevoLibroAutor(event.target.value)
                          }
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="nuevo-libro-paginas"
                          className="mb-1.5 block text-sm font-semibold text-ink"
                        >
                          Páginas *
                        </label>
                        <input
                          id="nuevo-libro-paginas"
                          type="number"
                          min={1}
                          value={libroPaginas}
                          onChange={(event) =>
                            handleLibroPaginasChange(event.target.value)
                          }
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="cantidad"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Cantidad
                    </label>
                    <input
                      id="cantidad"
                      type="number"
                      min={1}
                      value={cantidad}
                      onChange={(event) => setCantidad(event.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div className="flex items-end gap-5 pb-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={llevaScotch}
                        onChange={(event) =>
                          handleScotchChange(event.target.checked)
                        }
                        className="h-4 w-4 accent-brand"
                      />
                      Scotch
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={llevaEsquineros}
                        onChange={(event) =>
                          handleEsquinerosChange(event.target.checked)
                        }
                        className="h-4 w-4 accent-brand"
                      />
                      Esquineros
                    </label>
                  </div>
                </section>

                <section className="space-y-3 rounded-lg bg-slate-50 p-3 md:p-4">
                  <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                    <Wallet
                      className="h-5 w-5 text-brand"
                      aria-hidden="true"
                    />
                    Finanzas del pedido
                  </h3>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="precio-venta"
                        className="mb-1.5 block text-sm font-semibold text-ink"
                      >
                        Precio venta (CUP) *
                      </label>
                      <input
                        id="precio-venta"
                        type="number"
                        min={0}
                        step="0.01"
                        value={precioVenta}
                        onChange={(event) =>
                          handlePrecioChange(event.target.value)
                        }
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                      {tasaValida && precio > 0 ? (
                        <p className="mt-1 text-xs text-muted">
                          Precio de venta equivale a: ${number(precioEnUsd)} USD
                        </p>
                      ) : tasaError ? (
                        <p className="mt-1 text-xs text-amber-700">
                          No se pudo cargar la tasa de cambio.
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label
                          htmlFor="anticipo-requerido"
                          className="block text-sm font-semibold text-ink"
                        >
                          Anticipo
                        </label>
                        <div className="inline-flex rounded-md border border-line bg-white p-0.5">
                          {(["CUP", "USD"] as const).map((moneda) => (
                            <button
                              key={moneda}
                              type="button"
                              onClick={() =>
                                handleMonedaAnticipoChange(moneda)
                              }
                              aria-pressed={monedaAnticipo === moneda}
                              className={`rounded px-2 py-0.5 text-xs font-bold transition ${
                                monedaAnticipo === moneda
                                  ? "bg-brand text-white"
                                  : "text-muted hover:text-ink"
                              }`}
                            >
                              {moneda}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        id="anticipo-requerido"
                        type="number"
                        min={0}
                        step={esAnticipoUsd ? 1 : 0.01}
                        inputMode={esAnticipoUsd ? "numeric" : "decimal"}
                        value={anticipoRequerido}
                        onChange={(event) =>
                          handleAnticipoChange(event.target.value)
                        }
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                      {esAnticipoUsd ? (
                        <p className="mt-1 text-xs text-muted">
                          {tasaValida ? (
                            <>
                              Equivalente: {money(anticipoEnCup)} CUP (Tasa:{" "}
                              {Number.isInteger(tasaCambio ?? 0)
                                ? integer(tasaCambio ?? 0)
                                : number(tasaCambio ?? 0)}
                              )
                            </>
                          ) : tasaError ? (
                            <span className="text-amber-700">
                              No se pudo cargar la tasa de cambio.
                            </span>
                          ) : (
                            "Cargando tasa de cambio..."
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {vuelto > 0 ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                      Vuelto a entregar: {money(vuelto)} CUP
                    </p>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 text-sm text-muted sm:grid-cols-2">
                    <div>
                      <span className="font-semibold text-ink">
                        Costo unitario:
                      </span>{" "}
                      {costo ? money(costo.costo_total) : "Completa las páginas"}
                    </div>
                    <div>
                      <span className="font-semibold text-ink">
                        Costo total ({cantidadNum}):
                      </span>{" "}
                      {costo ? money(costoTotalPedido) : "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-ink">
                        Precio sugerido por unidad:
                      </span>{" "}
                      {costo ? money(costo.precio_sugerido) : "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-ink">
                        Ganancia estimada:
                      </span>{" "}
                      <span
                        className={
                          ganancia >= 0
                            ? "font-bold text-emerald-700"
                            : "font-bold text-red-700"
                        }
                      >
                        {costo ? money(ganancia) : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-ink">
                        Anticipo sugerido (CUP):
                      </span>{" "}
                      {costo ? money(costo.anticipo_sugerido) : "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-ink">
                        Total pagado (CUP):
                      </span>{" "}
                      {money(anticipoEnCup)}
                    </div>
                    <div>
                      <span className="font-semibold text-ink">
                        Saldo pendiente (CUP):
                      </span>{" "}
                      {money(saldo)}
                    </div>
                  </div>

                  {costo ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>Papel {money(costo.costo_papel)}</span>
                      <span>Tinta {money(costo.costo_tinta)}</span>
                      <span>Pegamento {money(costo.costo_pegamento)}</span>
                      <span>Scotch {money(costo.costo_scotch)}</span>
                      <span>Esquineros {money(costo.costo_esquineros)}</span>
                      <span>Portada {money(costo.costo_portada)}</span>
                      <span>
                        Encuadernación {money(costo.costo_encuadernacion)}
                      </span>
                      <span>Electricidad {money(costo.costo_electricidad)}</span>
                      <span>Diseño {money(costo.costo_diseno)}</span>
                    </div>
                  ) : null}
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink">Descuento</h3>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="w-full sm:max-w-sm">
                      <SelectBuscador
                        ariaLabel="Código de descuento"
                        options={codigoOptions}
                        value={codigoSeleccionado}
                        onChange={(option) => {
                          const nuevoCodigo = option?.value ?? "";
                          if (descuentoActivo) {
                            resetDescuento();
                          }
                          setCodigoDescuento(nuevoCodigo);
                          setDescuentoError(null);
                        }}
                        placeholder="Buscar código de descuento..."
                        isClearable
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void aplicarDescuento()}
                      disabled={saving || !codigoDescuento}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Aplicar descuento
                    </button>
                  </div>
                  {descuentoInfo ? (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {descuentoInfo}
                    </p>
                  ) : null}
                  {descuentoError ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {descuentoError}
                    </p>
                  ) : null}
                </section>

                <section>
                  <label
                    htmlFor="notas"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Notas
                  </label>
                  <textarea
                    id="notas"
                    rows={3}
                    value={notas}
                    onChange={(event) => setNotas(event.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </section>

                {submitError ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{submitError}</span>
                  </div>
                ) : null}
              </div>

              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-line bg-white px-4 py-3 sm:flex-row sm:justify-end md:px-6">
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={saving}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {saving ? "Guardando..." : "Guardar Pedido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

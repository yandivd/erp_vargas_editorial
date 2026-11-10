export type EmpleadoCargo = "GERENTE" | "OPERARIO" | "AYUDANTE";
export type PagoTipo = "SALARIO" | "UTILIDADES";
export type Moneda = "CUP" | "USD";

export type PagoNomina = {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  tipo: PagoTipo;
  tipo_label: string;
  fecha: string;
  mes_correspondiente: string;
  monto_pagado: number;
  moneda: Moneda;
  moneda_label: string;
  tasa_aplicada: number | null;
  notas: string;
  fecha_registro: string;
};

export type Empleado = {
  id: number;
  nombre: string;
  cargo: EmpleadoCargo;
  cargo_label: string;
  telefono: string;
  salario_base: number;
  activo: boolean;
  pagos: PagoNomina[];
};

export type EmpleadosData = {
  empleados: Empleado[];
};

export type UtilidadesDisponibles = {
  disponible_cup: number;
  disponible_usd: number;
  tasa_actual: number;
  saldo_cup: number;
  saldo_usd: number;
  anticipos: number;
  deudas: number;
  pasivos: number;
  mensaje: string;
  fecha_calculo: string;
};

export type MovimientoPago = {
  id: number;
  tipo_label: string;
  categoria_label: string;
  monto: number;
  moneda_label: string;
  metodo_label: string;
  concepto: string;
  fecha: string;
};

export type PagoEmpleadoData = {
  pago: PagoNomina;
  movimiento: MovimientoPago;
};

export const CARGOS_EMPLEADO: { value: EmpleadoCargo; label: string }[] = [
  { value: "GERENTE", label: "Gerente" },
  { value: "OPERARIO", label: "Operario" },
  { value: "AYUDANTE", label: "Ayudante" },
];

export const CONCEPTOS_PAGO: { value: PagoTipo; label: string }[] = [
  { value: "SALARIO", label: "Salario" },
  { value: "UTILIDADES", label: "Retiro de Utilidades" },
];

export const MONEDAS_PAGO: { value: Moneda; label: string }[] = [
  { value: "CUP", label: "CUP" },
  { value: "USD", label: "USD" },
];

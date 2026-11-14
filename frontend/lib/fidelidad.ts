import type { FidelidadCliente } from "@/lib/clientes";

export type FidelidadPublica = FidelidadCliente & {
  cliente_nombre: string;
  fecha_actualizacion?: string;
};

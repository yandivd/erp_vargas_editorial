"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  History,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import {
  tableClass,
  tableRowClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/dashboard/ui";
import { formatDate, money, number } from "@/lib/format";
import type { Empleado } from "@/lib/empleados";
import PagoEmpleadoButton from "./PagoEmpleadoButton";

export default function EmpleadosTable({
  empleados,
  tasaActual,
}: {
  empleados: Empleado[];
  tasaActual: number;
}) {
  const [historialId, setHistorialId] = useState<number | null>(null);

  function alternarHistorial(id: number) {
    setHistorialId((actual) => (actual === id ? null : id));
  }

  return (
    <div className={tableWrapClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Empleado</th>
            <th className={thClass}>Teléfono</th>
            <th className={thClass}>Salario base</th>
            <th className={thClass}>Estado</th>
            <th className={`${thClass} text-right`}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {empleados.map((empleado) => {
            const abierto = historialId === empleado.id;
            const pagos = empleado.pagos ?? [];

            return (
              <EmpleadoRows
                key={empleado.id}
                empleado={empleado}
                pagos={pagos}
                abierto={abierto}
                tasaActual={tasaActual}
                onToggle={() => alternarHistorial(empleado.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmpleadoRows({
  empleado,
  pagos,
  abierto,
  tasaActual,
  onToggle,
}: {
  empleado: Empleado;
  pagos: Empleado["pagos"];
  abierto: boolean;
  tasaActual: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`${tableRowClass} cursor-pointer ${
          abierto ? "bg-blue-50/60" : ""
        }`}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        aria-expanded={abierto}
      >
        <td className={tdClass}>
          <div className="flex items-center gap-2 font-bold text-ink">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-brand">
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <div>{empleado.nombre}</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-600">
                {empleado.cargo_label}
              </div>
            </div>
            {abierto ? (
              <ChevronUp
                className="ml-1 h-4 w-4 text-muted"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="ml-1 h-4 w-4 text-muted"
                aria-hidden="true"
              />
            )}
          </div>
        </td>
        <td className={tdClass}>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {empleado.telefono || "—"}
          </span>
        </td>
        <td className={tdClass}>
          <span className="font-semibold text-ink">
            {money(empleado.salario_base)}
          </span>
        </td>
        <td className={tdClass}>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
              empleado.activo
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {empleado.activo ? "Activo" : "Inactivo"}
          </span>
        </td>
        <td
          className={`${tdClass} text-right`}
          onClick={(event) => event.stopPropagation()}
        >
          <PagoEmpleadoButton
            empleados={[empleado]}
            empleadoInicialId={empleado.id}
            tasaActual={tasaActual}
            compact
          />
        </td>
      </tr>

      {abierto ? (
        <tr>
          <td colSpan={5} className="border-b border-line bg-slate-50/80 p-4">
            <div className="rounded-xl border border-line bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                <History className="h-4 w-4 text-brand" aria-hidden="true" />
                Historial de pagos de {empleado.nombre}
              </h3>

              {pagos.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-slate-50 px-3 py-4 text-sm text-muted">
                  <ReceiptText className="h-4 w-4" aria-hidden="true" />
                  Sin pagos registrados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className={thClass}>Fecha</th>
                        <th className={thClass}>Mes</th>
                        <th className={thClass}>Concepto</th>
                        <th className={thClass}>Monto</th>
                        <th className={thClass}>Tasa</th>
                        <th className={thClass}>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagos.map((pago) => (
                        <tr key={pago.id} className={tableRowClass}>
                          <td className={tdClass}>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays
                                className="h-3.5 w-3.5 text-muted"
                                aria-hidden="true"
                              />
                              {formatDate(pago.fecha)}
                            </span>
                          </td>
                          <td className={tdClass}>
                            {pago.mes_correspondiente || "—"}
                          </td>
                          <td className={tdClass}>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                pago.tipo === "UTILIDADES"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {pago.tipo_label}
                            </span>
                          </td>
                          <td className={tdClass}>
                            <span className="font-bold text-ink">
                              {money(pago.monto_pagado, pago.moneda)}
                            </span>{" "}
                            <span className="text-xs text-muted">
                              {pago.moneda}
                            </span>
                          </td>
                          <td className={tdClass}>
                            {pago.tasa_aplicada
                              ? `${number(pago.tasa_aplicada)} CUP/USD`
                              : "—"}
                          </td>
                          <td className={tdClass}>{pago.notas || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

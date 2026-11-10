"use client";

import { Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PagoModal from "./PagoModal";
import type { Empleado } from "@/lib/empleados";

export default function PagoEmpleadoButton({
  empleados,
  tasaActual,
  empleadoInicialId,
  compact = false,
}: {
  empleados: Empleado[];
  tasaActual: number;
  empleadoInicialId?: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (empleados.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:bg-blue-50 hover:text-brand"
            : "inline-flex items-center justify-center gap-2 rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand transition hover:bg-blue-50"
        }
      >
        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
        Pagar
      </button>

      {open ? (
        <PagoModal
          empleados={empleados}
          empleadoInicialId={empleadoInicialId}
          tasaActual={tasaActual}
          onClose={() => setOpen(false)}
          onPagado={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

"use client";

import { Printer, X } from "lucide-react";

export default function TicketActions() {
  return (
    <div className="no-print fixed right-4 top-4 z-50 flex gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-dark"
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        Imprimir
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-muted shadow-lg transition hover:bg-slate-50"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

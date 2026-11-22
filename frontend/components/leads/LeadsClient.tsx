"use client";

import { useState } from "react";
import { Plus, SearchX, Target } from "lucide-react";
import type { Lead } from "@/lib/leads";
import LeadModal from "./LeadModal";
import LeadsTable from "./LeadsTable";

export default function LeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink"><Target className="h-7 w-7 text-brand" />Leads</h1>
          <p className="mt-1 text-sm text-muted">Contactos potenciales por vía, estado y conversión a cliente.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted"><span className="font-bold text-ink">{initialLeads.length}</span> lead{initialLeads.length === 1 ? "" : "s"}</div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="h-4 w-4" />Nuevo lead</button>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        {initialLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
            <SearchX className="mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-ink">No hay leads todavía</p>
            <p className="mt-1 text-sm">Registra el primer contacto potencial.</p>
          </div>
        ) : <LeadsTable leads={initialLeads} />}
      </section>

      <LeadModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

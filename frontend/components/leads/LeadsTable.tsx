"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Lead } from "@/lib/leads";
import LeadModal from "./LeadModal";

const estadoClass: Record<string, string> = {
  nuevo: "bg-slate-100 text-slate-700", contactado: "bg-blue-50 text-blue-700", interesado: "bg-amber-50 text-amber-700",
  convertido: "bg-emerald-50 text-emerald-700", perdido: "bg-red-50 text-red-700",
};

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Lead | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const remove = async (lead: Lead) => {
    if (!confirm(`¿Eliminar lead ${lead.nombre || lead.telefono || lead.id}?`)) return;
    setBusyId(lead.id);
    try {
      const res = await fetch(`/api/bff/leads/${lead.id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } finally { setBusyId(null); }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-line text-left text-slate-500"><th className="py-3 pr-3">Contacto</th><th className="py-3 pr-3">Vía</th><th className="py-3 pr-3">Estado</th><th className="py-3 pr-3">Interés</th><th className="py-3 pr-3">Cliente</th><th className="py-3 pr-3 text-right">Acciones</th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-line/70 align-top">
                <td className="py-3 pr-3"><div className="font-medium text-ink">{l.nombre || l.telefono || `Lead #${l.id}`}</div>{l.nombre && l.telefono ? <div className="text-xs text-muted">{l.telefono}</div> : null}{l.notas ? <div className="mt-1 max-w-xs truncate text-xs text-muted">{l.notas}</div> : null}</td>
                <td className="py-3 pr-3 text-muted">{l.via_contacto_display}</td>
                <td className="py-3 pr-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${estadoClass[l.estado] || "bg-slate-100 text-slate-700"}`}>{l.estado_display}</span></td>
                <td className="py-3 pr-3 text-muted">{l.interes || "-"}</td>
                <td className="py-3 pr-3 text-muted">{l.cliente_nombre || "-"}</td>
                <td className="py-3 pr-0"><div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(l)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Editar</button>
                  <button onClick={() => remove(l)} disabled={busyId === l.id} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" />Eliminar</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LeadModal open={!!editing} onClose={() => setEditing(null)} lead={editing} />
    </>
  );
}

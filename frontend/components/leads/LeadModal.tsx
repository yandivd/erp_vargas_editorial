"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ESTADO_LEAD_OPTIONS, VIA_CONTACTO_OPTIONS, type Lead } from "@/lib/leads";

type Props = { open: boolean; onClose: () => void; lead?: Lead | null };
const empty = { nombre: "", telefono: "", via_contacto: "whatsapp", estado: "nuevo", interes: "", notas: "" };

export default function LeadModal({ open, onClose, lead }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(lead ? {
      nombre: lead.nombre || "", telefono: lead.telefono || "", via_contacto: lead.via_contacto || "whatsapp",
      estado: lead.estado || "nuevo", interes: lead.interes || "", notas: lead.notas || "",
    } : empty);
    setError(null);
  }, [open, lead]);

  if (!open) return null;
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const url = lead ? `/api/bff/leads/${lead.id}/` : "/api/bff/leads/";
      const method = lead ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "No se pudo guardar el lead.");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-ink">{lead ? "Editar lead" : "Nuevo lead"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Nombre</span><input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Teléfono</span><input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Vía de contacto</span><select value={form.via_contacto} onChange={(e) => set("via_contacto", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">{VIA_CONTACTO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Estado</span><select value={form.estado} onChange={(e) => set("estado", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">{ESTADO_LEAD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Interés / producto</span><input value={form.interes} onChange={(e) => set("interes", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Notas</span><textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

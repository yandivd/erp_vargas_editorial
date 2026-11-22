"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ESTADO_LEAD_OPTIONS, INTERES_GENERAL, VIA_CONTACTO_OPTIONS, type Lead } from "@/lib/leads";

type LibroOption = { id: number; titulo: string };
type Props = { open: boolean; onClose: () => void; lead?: Lead | null };
const empty = { nombre: "", telefono: "", via_contacto: "whatsapp", estado: "nuevo", interes: "", notas: "" };

function parseInteres(interes: string) {
  const raw = (interes || "").trim();
  if (!raw) return { general: false, libros: [] as string[] };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const general = parts.includes(INTERES_GENERAL);
  const libros = parts.filter((p) => p !== INTERES_GENERAL);
  return { general, libros };
}

export default function LeadModal({ open, onClose, lead }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libros, setLibros] = useState<LibroOption[]>([]);
  const [buscaLibro, setBuscaLibro] = useState("");
  const [interesGeneral, setInteresGeneral] = useState(false);
  const [librosSeleccionados, setLibrosSeleccionados] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const parsed = parseInteres(lead?.interes || "");
    setForm(lead ? {
      nombre: lead.nombre || "", telefono: lead.telefono || "", via_contacto: lead.via_contacto || "whatsapp",
      estado: lead.estado || "nuevo", interes: lead.interes || "", notas: lead.notas || "",
    } : empty);
    setInteresGeneral(parsed.general);
    setLibrosSeleccionados(parsed.libros);
    setBuscaLibro("");
    setError(null);
  }, [open, lead]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/bff/libros/?all=1")
      .then((r) => r.json())
      .then((payload) => {
        if (!active) return;
        const data = payload?.data ?? payload;
        const rows = Array.isArray(data) ? data : (data?.libros ?? data?.results ?? []);
        setLibros(rows.map((l: any) => ({ id: l.id, titulo: l.titulo || `Libro ${l.id}` })));
      })
      .catch(() => { if (active) setLibros([]); });
    return () => { active = false; };
  }, [open]);

  const librosFiltrados = useMemo(() => {
    const q = buscaLibro.trim().toLowerCase();
    if (!q) return libros.slice(0, 30);
    return libros.filter((l) => l.titulo.toLowerCase().includes(q)).slice(0, 30);
  }, [libros, buscaLibro]);

  if (!open) return null;
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const toggleLibro = (titulo: string) => {
    setLibrosSeleccionados((prev) => prev.includes(titulo) ? prev.filter((t) => t !== titulo) : [...prev, titulo]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const interesParts = [...librosSeleccionados];
      if (interesGeneral) interesParts.unshift(INTERES_GENERAL);
      const payloadForm = { ...form, interes: interesParts.join(", ") };
      const url = lead ? `/api/bff/leads/${lead.id}/` : "/api/bff/leads/";
      const method = lead ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadForm) });
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
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sticky top-0 bg-white z-10">
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

          <div className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Interés / producto</span>
            <label className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <input type="checkbox" checked={interesGeneral} onChange={(e) => setInteresGeneral(e.target.checked)} />
              <span>{INTERES_GENERAL} <span className="text-muted">(cómo funciona, si estamos trabajando, etc.)</span></span>
            </label>
            <input value={buscaLibro} onChange={(e) => setBuscaLibro(e.target.value)} placeholder="Buscar libro..." className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2" />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1">
              {librosFiltrados.length === 0 ? <div className="text-xs text-muted px-1 py-2">No hay libros.</div> : librosFiltrados.map((l) => (
                <label key={l.id} className="flex items-center gap-2 px-1 py-1 hover:bg-slate-50 rounded">
                  <input type="checkbox" checked={librosSeleccionados.includes(l.titulo)} onChange={() => toggleLibro(l.titulo)} />
                  <span className="text-sm">{l.titulo}</span>
                </label>
              ))}
            </div>
            {librosSeleccionados.length > 0 ? <div className="mt-2 flex flex-wrap gap-1">{librosSeleccionados.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{t}<button type="button" onClick={() => toggleLibro(t)} className="text-blue-500">×</button></span>)}</div> : null}
          </div>

          <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Notas</span><textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          {lead ? <div className="text-xs text-muted">Fecha de creación: {new Date(lead.fecha_creacion).toLocaleString()}</div> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import { Save, Truck } from "lucide-react";
import TableControls from "@/components/ui/TableControls";
import { useTable } from "@/lib/useTable";

type Tarifa = { provincia: string; municipio: string; costo: number };

export default function MensajeriasClient({ initialTarifas }: { initialTarifas: Tarifa[] }) {
  const [tarifas, setTarifas] = useState(initialTarifas);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const provincias = useMemo(() => Array.from(new Set(tarifas.map((t) => t.provincia))).map((p) => ({ value: p, label: p })), [tarifas]);
  const t = useTable(tarifas, {
    searchKeys: (r) => [r.provincia, r.municipio],
    filters: { provincia: (r, v) => r.provincia === v },
  });

  const update = (provincia: string, municipio: string, costo: number) => {
    setTarifas((prev) => prev.map((r) => r.provincia === provincia && r.municipio === municipio ? { ...r, costo } : r));
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/bff/configuracion/mensajeria/", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tarifas }) });
      if (!res.ok) throw new Error();
      setMsg("Tarifas guardadas.");
    } catch { setMsg("No se pudieron guardar las tarifas."); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink"><Truck className="h-7 w-7 text-brand" />Mensajerías</h1><p className="mt-1 text-sm text-muted">Tarifas por provincia y municipio.</p></div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Guardando..." : "Guardar"}</button>
      </div>
      {msg ? <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div> : null}
      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <TableControls search={t.search} onSearch={t.setSearch} filters={t.filters} onFilter={t.setFilter} filterDefs={[{ key: "provincia", label: "Provincia", options: provincias }]} page={t.page} totalPages={t.totalPages} total={t.total} start={t.start} end={t.end} onPage={t.setPage} />
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-line text-left text-slate-500"><th className="py-3 pr-3">Provincia</th><th className="py-3 pr-3">Municipio</th><th className="py-3 pr-0 text-right">Costo (CUP)</th></tr></thead><tbody>
          {t.pageRows.map((r) => <tr key={`${r.provincia}-${r.municipio}`} className="border-b border-line/70"><td className="py-2 pr-3">{r.provincia}</td><td className="py-2 pr-3">{r.municipio}</td><td className="py-2 pr-0 text-right"><input type="number" min="0" step="1" value={r.costo} onChange={(e) => update(r.provincia, r.municipio, Number(e.target.value || 0))} className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-right" /></td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}

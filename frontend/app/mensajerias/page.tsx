"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Truck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { money } from "@/lib/format";
import { PROVINCIAS, MUNICIPIOS } from "@/lib/lugares";

type Tarifa = { provincia: string; municipio: string; costo: number };

export default function MensajeriasPage() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ tarifas: Tarifa[] }>("configuracion/mensajeria")
      .then((data) => { if (!cancelled) { setTarifas(data.tarifas || []); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "No se pudieron cargar las tarifas."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const porProvincia = useMemo(() => {
    const map = new Map<string, Tarifa[]>();
    for (const p of PROVINCIAS) map.set(p, []);
    for (const t of tarifas) {
      if (!map.has(t.provincia)) map.set(t.provincia, []);
      map.get(t.provincia)!.push(t);
    }
    for (const p of PROVINCIAS) {
      const orden = MUNICIPIOS[p as keyof typeof MUNICIPIOS] || [];
      map.get(p)!.sort((a, b) => orden.indexOf(a.municipio as any) - orden.indexOf(b.municipio as any));
    }
    return map;
  }, [tarifas]);

  function setCosto(provincia: string, municipio: string, value: string) {
    const costo = value === "" ? 0 : Math.max(0, Number(value));
    setTarifas((prev) => prev.map((t) => (t.provincia === provincia && t.municipio === municipio ? { ...t, costo: Number.isFinite(costo) ? costo : t.costo } : t)));
    setOkMsg(null);
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const data = await apiFetch<{ tarifas: Tarifa[] }>("configuracion/mensajeria", {
        method: "PUT",
        body: JSON.stringify({ tarifas }),
      });
      setTarifas(data.tarifas || tarifas);
      setOkMsg("Tarifas guardadas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar las tarifas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink"><Truck className="h-6 w-6 text-brand" aria-hidden="true" />Mensajerías</h1>
          <p className="mt-1 text-sm text-muted">Configura el costo de mensajería por provincia y municipio.</p>
        </div>
        <button type="button" onClick={guardar} disabled={saving || loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Guardar cambios
        </button>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {okMsg ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{okMsg}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white py-16 text-sm text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Cargando tarifas...</div>
      ) : (
        <div className="space-y-6">
          {Array.from(porProvincia.entries()).map(([provincia, items]) => (
            <section key={provincia} className="rounded-xl border border-line bg-white p-4 shadow-sm md:p-5">
              <h2 className="mb-4 text-lg font-bold text-ink">{provincia}</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      <th className="px-2 py-2 font-semibold">Municipio</th>
                      <th className="px-2 py-2 font-semibold w-48">Costo (CUP)</th>
                      <th className="px-2 py-2 font-semibold w-36">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t) => (
                      <tr key={`${t.provincia}-${t.municipio}`} className="border-b border-line/60 last:border-0">
                        <td className="px-2 py-2 font-medium text-ink">{t.municipio}</td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={t.costo}
                            onChange={(e) => setCosto(t.provincia, t.municipio, e.target.value)}
                            className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                        </td>
                        <td className="px-2 py-2 text-muted">{money(Number(t.costo || 0), "CUP")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

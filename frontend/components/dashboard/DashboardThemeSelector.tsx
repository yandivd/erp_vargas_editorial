"use client";

import { useEffect, useState, useTransition } from "react";
import { Palette } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { normalizarTemaDecoracion, type TemaDecoracion } from "@/lib/decoracion";

const OPTIONS: { value: TemaDecoracion; label: string }[] = [
  { value: "navidad", label: "Navidad" },
  { value: "halloween", label: "Halloween" },
  { value: "ninguno", label: "Sin decoración" },
];

export default function DashboardThemeSelector() {
  const [tema, setTema] = useState<TemaDecoracion>("navidad");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelado = false;
    apiFetch<{ tema: string }>("configuracion/decoracion/")
      .then((d) => { if (!cancelado) setTema(normalizarTemaDecoracion(d?.tema)); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  function onChange(next: TemaDecoracion) {
    const prev = tema;
    setTema(next);
    startTransition(async () => {
      try {
        await apiFetch("configuracion/decoracion/", {
          method: "PUT",
          body: JSON.stringify({ tema: next }),
        });
      } catch {
        setTema(prev);
      }
    });
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700">
      <Palette className="h-4 w-4 text-slate-500" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only sm:text-xs sm:font-semibold sm:text-slate-500">Decoración</span>
      <select
        value={tema}
        disabled={pending}
        onChange={(e) => onChange(normalizarTemaDecoracion(e.target.value))}
        className="bg-transparent text-sm font-semibold text-slate-700 outline-none disabled:opacity-60"
        aria-label="Decoración del catálogo"
      >
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

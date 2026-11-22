import { AlertTriangle } from "lucide-react";
import EntregasClient from "@/components/entregas/EntregasClient";
import { apiFetch } from "@/lib/api";
import type { EntregaListItem } from "@/lib/entregas";

export const dynamic = "force-dynamic";
type Tab = "pendientes" | "historial";

export default async function EntregasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab: Tab = params.tab === "historial" ? "historial" : "pendientes";
  let entregas: EntregaListItem[] = []; let error = "";
  try { entregas = await apiFetch<EntregaListItem[]>(`entregas?tab=${encodeURIComponent(tab)}`); }
  catch (err) { error = err instanceof Error ? err.message : "No se pudieron cargar las entregas."; }
  if (error) return <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>{error}</p></div>;
  return <EntregasClient initialEntregas={entregas} tab={tab} />;
}

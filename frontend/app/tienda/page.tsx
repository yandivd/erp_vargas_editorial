import { AlertTriangle } from "lucide-react";
import TiendaClient from "@/components/tienda/TiendaClient";
import { apiFetch } from "@/lib/api";
import type { PedidoListItem } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

export default async function TiendaPage() {
  let pedidos: PedidoListItem[] = []; let error: string | null = null;
  try { pedidos = await apiFetch<PedidoListItem[]>("tienda"); }
  catch (e) { error = e instanceof Error ? e.message : "No se pudo cargar la tienda."; }
  if (error) return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>No se pudo cargar la tienda.</strong><div>{error}</div></div></div>;
  return <TiendaClient initialPedidos={pedidos} />;
}

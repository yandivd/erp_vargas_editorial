import { AlertTriangle } from "lucide-react";
import LeadsClient from "@/components/leads/LeadsClient";
import { apiFetch } from "@/lib/api";
import type { Lead } from "@/lib/leads";

export const dynamic = "force-dynamic";

type LeadsData = { leads: Lead[] };

export default async function LeadsPage() {
  let leads: Lead[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<LeadsData>("leads/");
    leads = data.leads ?? [];
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudieron cargar los leads.";
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div><strong>No se pudieron cargar los leads.</strong><div>{error}</div></div>
      </div>
    );
  }

  return <LeadsClient initialLeads={leads} />;
}

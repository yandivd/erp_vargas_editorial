import { AlertTriangle, Gift } from "lucide-react";
import FidelidadAdminTable from "@/components/fidelidad/FidelidadAdminTable";
import { apiFetchEnvelope } from "@/lib/api";
import type { ClienteListItem } from "@/lib/clientes";

export const dynamic = "force-dynamic";

async function cargarClientes(): Promise<ClienteListItem[]> {
  const clientes: ClienteListItem[] = [];
  let page = 1;

  while (true) {
    const envelope = await apiFetchEnvelope<{ clientes: ClienteListItem[] }>(
      `clientes/?per_page=500&page=${page}`,
    );
    clientes.push(...(envelope.data.clientes ?? []));

    if (!envelope.pagination?.has_next) {
      break;
    }

    page += 1;
  }

  return clientes;
}

export default async function FidelidadPage() {
  const result = await cargarClientes()
    .then((clientes) => ({ clientes, error: null }))
    .catch((error: unknown) => ({
      clientes: [] as ClienteListItem[],
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las tarjetas de fidelidad.",
    }));

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
            <Gift className="h-7 w-7 text-brand" aria-hidden="true" />
            Fidelidad
          </h1>
          <p className="mt-1 text-sm text-muted">
            Administra los sellos y bonos de cada cliente.
          </p>
        </div>
      </div>

      {result.error ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar las tarjetas.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        <FidelidadAdminTable clientes={result.clientes} />
      </section>
    </div>
  );
}

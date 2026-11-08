import { AlertTriangle, SearchX, Users } from "lucide-react";
import ClientesFilters from "@/components/clientes/ClientesFilters";
import ClientesPagination from "@/components/clientes/ClientesPagination";
import ClientesTable from "@/components/clientes/ClientesTable";
import NuevoClienteModal from "@/components/clientes/NuevoClienteModal";
import {
  apiFetchEnvelope,
  type ApiPagination,
} from "@/lib/api";
import type { ClienteListItem } from "@/lib/clientes";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    nombre?: string;
    telefono?: string;
    deuda?: string;
    page?: string;
  }>;
};

type ClientesData = {
  clientes: ClienteListItem[];
};

export default async function ClientesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nombre = (params.nombre ?? "").trim();
  const telefono = (params.telefono ?? "").trim();
  const deuda = (params.deuda ?? "").trim();
  const parsedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const query = new URLSearchParams();
  query.set("page", String(page));
  if (nombre) {
    query.set("nombre", nombre);
  }
  if (telefono) {
    query.set("telefono", telefono);
  }
  if (deuda) {
    query.set("deuda", deuda);
  }

  const result = await apiFetchEnvelope<ClientesData>(
    `clientes/?${query.toString()}`,
  )
    .then((envelope) => ({ envelope, error: null }))
    .catch((error: unknown) => ({
      envelope: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los clientes.",
    }));

  if (result.error || !result.envelope) {
    return (
      <div>
        <PageHeader />
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar los clientes.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const clientes = result.envelope.data.clientes ?? [];
  const pagination = result.envelope.pagination as
    | ApiPagination
    | null
    | undefined;

  return (
    <div>
      <PageHeader count={pagination?.count ?? clientes.length} />

      <ClientesFilters
        initialNombre={nombre}
        initialTelefono={telefono}
        initialDeuda={deuda}
      />

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        {clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
            <SearchX className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-ink">
              No encontramos clientes
            </p>
            <p className="mt-1 text-sm">
              Ajusta los filtros o registra un nuevo cliente.
            </p>
          </div>
        ) : (
          <>
            <ClientesTable clientes={clientes} />

            {pagination ? (
              <ClientesPagination
                pagination={pagination}
                nombre={nombre}
                telefono={telefono}
                deuda={deuda}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function PageHeader({ count }: { count?: number }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
          <Users className="h-7 w-7 text-brand" aria-hidden="true" />
          Clientes
        </h1>
        <p className="mt-1 text-sm text-muted">
          Directorio de clientes, deudas y segmentación comercial.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {typeof count === "number" ? (
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
            <span className="font-bold text-ink">{count}</span>{" "}
            cliente{count === 1 ? "" : "s"}
          </div>
        ) : null}
        <NuevoClienteModal />
      </div>
    </div>
  );
}

import { AlertTriangle, ClipboardList, SearchX } from "lucide-react";
import Link from "next/link";
import PedidosFilters from "@/components/pedidos/PedidosFilters";
import PedidosPagination from "@/components/pedidos/PedidosPagination";
import PedidosTable from "@/components/pedidos/PedidosTable";
import {
  apiFetch,
  apiFetchEnvelope,
  type ApiPagination,
} from "@/lib/api";
import {
  type EstadoPedido,
  type PedidoListItem,
} from "@/lib/pedidos";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    search?: string;
    estado?: string;
    page?: string;
    en_taller?: string;
  }>;
};

export default async function PedidosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const estado = (params.estado ?? "").trim();
  const enTaller =
    params.en_taller === "true" || params.en_taller === "1";
  const parsedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const query = new URLSearchParams();
  query.set("page", String(page));
  query.set("per_page", "20");
  if (search) {
    query.set("search", search);
  }
  if (estado) {
    query.set("estado", estado);
  }
  if (enTaller) {
    query.set("en_taller", "true");
  }

  const [estados, pedidosResult] = await Promise.all([
    apiFetch<EstadoPedido[]>("pedidos/estados/").catch(() => []),
    apiFetchEnvelope<PedidoListItem[]>(`pedidos/?${query.toString()}`)
      .then((envelope) => ({ envelope, error: null }))
      .catch((error: unknown) => ({
        envelope: null,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los pedidos.",
      })),
  ]);

  if (pedidosResult.error || !pedidosResult.envelope) {
    return (
      <div>
        <PageHeader enTaller={enTaller} />
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudieron cargar los pedidos.</strong>
            <div>{pedidosResult.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const pedidos = pedidosResult.envelope.data;
  const pagination = pedidosResult.envelope.pagination as
    | ApiPagination
    | null
    | undefined;

  return (
    <div>
      <PageHeader count={pagination?.count} enTaller={enTaller} />
      <ViewTabs enTaller={enTaller} search={search} />

      <PedidosFilters
        estados={estados}
        initialSearch={search}
        initialEstado={estado}
        enTaller={enTaller}
      />

      <section className="rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6">
        {pedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted">
            <SearchX className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-ink">
              {enTaller
                ? "No hay pedidos en taller con estos filtros"
                : "No encontramos pedidos"}
            </p>
            <p className="mt-1 text-sm">
              {enTaller
                ? "Prueba con otro estado del taller o limpia la búsqueda."
                : "Ajusta la búsqueda o el filtro de estado."}
            </p>
          </div>
        ) : (
          <>
            <PedidosTable pedidos={pedidos} estados={estados} />

            {pagination ? (
              <PedidosPagination
                pagination={pagination}
                search={search}
                estado={estado}
                enTaller={enTaller}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function PageHeader({
  count,
  enTaller = false,
}: {
  count?: number;
  enTaller?: boolean;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-ink">
          <ClipboardList className="h-7 w-7 text-brand" aria-hidden="true" />
          Pedidos
        </h1>
        <p className="mt-1 text-sm text-muted">
          {enTaller
            ? "Pedidos activos en producción, desde impresión hasta encuadernado."
            : "Órdenes del taller, anticipos y estado de producción."}
        </p>
      </div>
      {typeof count === "number" ? (
        <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
          <span className="font-bold text-ink">{count}</span>{" "}
          {enTaller ? "en taller" : `resultado${count === 1 ? "" : "s"}`}
        </div>
      ) : null}
    </div>
  );
}

function ViewTabs({
  enTaller,
  search,
}: {
  enTaller: boolean;
  search: string;
}) {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }

  const tallerParams = new URLSearchParams(params);
  tallerParams.set("en_taller", "true");
  const tallerQuery = tallerParams.toString();
  const todosQuery = params.toString();

  const baseClass =
    "inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition";
  const activeClass = "bg-brand text-white shadow-sm";
  const inactiveClass = "text-muted hover:bg-slate-100 hover:text-ink";

  return (
    <div className="mb-4 inline-flex rounded-xl border border-line bg-white p-1 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
      <Link
        href={`/pedidos?${tallerQuery}`}
        className={`${baseClass} ${enTaller ? activeClass : inactiveClass}`}
        aria-current={enTaller ? "page" : undefined}
      >
        En Taller
      </Link>
      <Link
        href={todosQuery ? `/pedidos?${todosQuery}` : "/pedidos"}
        className={`${baseClass} ${enTaller ? inactiveClass : activeClass}`}
        aria-current={enTaller ? undefined : "page"}
      >
        Todos
      </Link>
    </div>
  );
}

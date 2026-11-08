import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calculator,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import LibroModal from "@/components/libros/LibroModal";
import { SectionCard } from "@/components/dashboard/ui";
import DesgloseCostos from "@/components/ui/DesgloseCostos";
import { apiFetch } from "@/lib/api";
import {
  calcularCostoPorUnidad,
  type ParametrosCosto,
} from "@/lib/costos";
import { money } from "@/lib/format";
import { libroImagenSrc, type Libro } from "@/lib/libros";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ParametrosResponse = {
  parametros: ParametrosCosto;
};

export default async function LibroDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [libroResult, parametrosResult] = await Promise.all([
    apiFetch<Libro>(`libros/${encodeURIComponent(id)}/`)
      .then((libro) => ({ ok: true as const, libro }))
      .catch((error: unknown) => ({
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el libro.",
      })),
    apiFetch<ParametrosResponse>("libros/parametros-costo/").catch(() => null),
  ]);

  if (!libroResult.ok) {
    return (
      <div>
        <BackLink />
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el libro.</strong>
            <div>{libroResult.message}</div>
          </div>
        </div>
      </div>
    );
  }

  const libro = libroResult.libro;
  const costo = parametrosResult
    ? calcularCostoPorUnidad(
        libro.paginas,
        false,
        false,
        parametrosResult.parametros,
      )
    : null;
  const precioVenta = Number(libro.precio);
  const margen = costo ? precioVenta - costo.costo_total : null;

  return (
    <div>
      <BackLink />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="aspect-[21/9] w-44 shrink-0 overflow-hidden rounded-xl border border-line bg-slate-50 sm:w-60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={libroImagenSrc(libro.imagen)}
              alt={`Portada de ${libro.titulo}`}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">{libro.titulo}</h1>
            <p className="mt-1 text-sm text-muted">
              {libro.autor || "Sin autor"}
            </p>
            <p className="mt-3 text-sm text-muted">
              {libro.paginas} páginas · Precio de venta{" "}
              <strong className="text-ink">{money(libro.precio)}</strong>
            </p>
          </div>
        </div>

        <LibroModal libro={libro} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="Información del libro"
          icon={<BookOpen className="h-5 w-5 text-brand" aria-hidden="true" />}
          className="xl:col-span-2"
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Info label="Título" value={libro.titulo} />
            <Info label="Autor" value={libro.autor || "—"} />
            <Info label="Páginas" value={String(libro.paginas)} />
            <Info label="Precio de venta" value={money(libro.precio)} />
          </dl>

          <div className="mt-6 border-t border-line pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                  <Calculator
                    className="h-4 w-4 text-brand"
                    aria-hidden="true"
                  />
                  Costo desglosado de producción
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Calculado con los parámetros actuales para {libro.paginas}{" "}
                  páginas.
                </p>
              </div>
              <div className="sm:text-right">
                <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                  Costo total de producción
                </div>
                <div className="mt-1 text-xl font-extrabold text-ink">
                  {costo ? money(costo.costo_total) : "—"}
                </div>
              </div>
            </div>

            {costo ? (
              <DesgloseCostos
                costo={costo}
                className="mt-3 gap-x-5 gap-y-2 text-sm"
              />
            ) : (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No se pudieron cargar los parámetros de costo para calcular el
                desglose.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Precio y margen"
          icon={<Wallet className="h-5 w-5 text-brand" aria-hidden="true" />}
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4">
            <Info label="Precio de venta" value={money(libro.precio)} />
            <Info
              label="Precio sugerido por unidad"
              value={costo ? money(costo.precio_sugerido) : "—"}
            />
            <Info
              label="Costo total de producción"
              value={costo ? money(costo.costo_total) : "—"}
            />
            <Info
              label="Margen bruto por unidad"
              value={margen === null ? "—" : money(margen)}
              valueClassName={
                margen === null
                  ? ""
                  : margen >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
              }
            />
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/libros"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Volver a libros
    </Link>
  );
}

function Info({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-medium text-ink ${valueClassName}`}>
        {value}
      </dd>
    </div>
  );
}

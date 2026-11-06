import Image from "next/image";
import Link from "next/link";
import BookCatalog from "@/components/catalogos/BookCatalog";
import { apiFetch } from "@/lib/api";
import type { LibroPublico } from "@/lib/catalogos";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  let books: LibroPublico[] = [];
  let error: string | null = null;

  try {
    books = await apiFetch<LibroPublico[]>("catalogo/");
  } catch (requestError) {
    error =
      requestError instanceof Error
        ? requestError.message
        : "No se pudo cargar el catálogo.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <header className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="/img/logo1.jpg"
            alt="Vargas Editorial"
            width={260}
            height={120}
            priority
            className="h-auto max-h-14 w-full object-contain"
          />
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Catálogo público</h1>
            <p className="mt-1 text-sm text-muted">
              Encuadernación y edición para lectores.
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Iniciar Sesión
        </Link>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-800">
          <p className="font-semibold">No se pudo cargar el catálogo.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <BookCatalog books={books} error={error} />
      )}
    </div>
  );
}

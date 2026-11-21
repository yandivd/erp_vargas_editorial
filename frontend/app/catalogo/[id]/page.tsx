import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CatalogoProductClient from "./CatalogoProductClient";

type CatalogoEnvelope = {
  ok: boolean;
  data?: {
    id: number;
    titulo: string;
    autor: string;
    descripcion?: string;
    paginas?: number;
    precio: string;
    imagen?: string | null;
    imagen_base?: string | null;
    imagen_con_esquineros?: string | null;
    imagen_con_cantos?: string | null;
    disponible: boolean;
  };
  error?: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.FRONTEND_URL ||
    "https://erp-vargas-editorial.vercel.app"
  ).replace(/\/+$/, "");
}

function getApiBaseUrl(): string | null {
  const base = process.env.DJANGO_API_URL || process.env.NEXT_PUBLIC_DJANGO_URL;
  if (!base) return null;
  return base.replace(/\/+$/, "");
}

async function fetchLibro(id: string): Promise<CatalogoEnvelope["data"] | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;
  const apiUrl = apiBase.includes("/api/v1")
    ? `${apiBase}/catalogo/libros/${id}/`
    : `${apiBase}/api/v1/catalogo/libros/${id}/`;

  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => null)) as CatalogoEnvelope | null;
    if (!res.ok || !payload?.ok || !payload.data) return null;
    return payload.data;
  } catch {
    return null;
  }
}

function resolveImageUrl(libro: NonNullable<CatalogoEnvelope["data"]>, baseUrl: string): string {
  const raw = libro.imagen_base || libro.imagen || "";
  if (!raw) return `${baseUrl}/img/catalogo-preview.jpg`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${baseUrl}${raw}`;
  return `${baseUrl}/${raw}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const libro = await fetchLibro(id);
  const baseUrl = getBaseUrl();

  if (!libro) {
    return {
      title: "Libro no encontrado - Vargas Editorial",
    };
  }

  const imageUrl = resolveImageUrl(libro, baseUrl);
  const description = "Mira este asombroso libro disponible para encargar en Vargas Editorial";
  const title = `${libro.titulo} - Vargas Editorial`;
  const url = `${baseUrl}/catalogo/${libro.id}`;

  return {
    title,
    description,
    openGraph: {
      title: libro.titulo,
      description,
      url,
      siteName: "Vargas Editorial",
      images: [
        {
          url: imageUrl,
          alt: `Portada de ${libro.titulo}`,
        },
      ],
      locale: "es_CU",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: libro.titulo,
      description,
      images: [imageUrl],
    },
  };
}

export default async function CatalogoLibroPage({ params }: PageProps) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const libro = await fetchLibro(id);
  if (!libro) notFound();

  return <CatalogoProductClient libro={libro} />;
}

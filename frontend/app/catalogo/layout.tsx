import type { Metadata } from 'next';

// Dominio base para construir la URL absoluta de la imagen
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://erp-vargas-editorial.vercel.app';
const previewImageUrl = `${baseUrl}/img/catalogo-preview.jpg`;

export const metadata: Metadata = {
  title: 'Catálogo - Vargas Editorial',
  description: 'Explora nuestro catálogo público de encuadernación y edición. Libros por encargo y encuadernación artesanal.',
  openGraph: {
    title: 'Catálogo - Vargas Editorial',
    description: 'Explora nuestro catálogo público de encuadernación y edición.',
    url: `${baseUrl}/catalogo`,
    siteName: 'Vargas Editorial',
    images: [
      {
        url: previewImageUrl,
        width: 1200,
        height: 630,
        alt: 'Vista previa del Catálogo de Vargas Editorial',
      },
    ],
    locale: 'es_CU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Catálogo - Vargas Editorial',
    description: 'Explora nuestro catálogo público de encuadernación y edición.',
    images: [previewImageUrl],
  },
};

export default function CatalogoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppShell from "@/components/AppShell";
import CartPreviewSidebar from "@/components/catalogos/CartPreviewSidebar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vargas Editorial - ERP",
  description: "Sistema de gestión editorial y encuadernación.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-app text-ink xl:pr-64">
        <AppShell>{children}</AppShell>
        <CartPreviewSidebar />
      </body>
    </html>
  );
}

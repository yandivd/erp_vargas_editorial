"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (
    pathname === "/login" ||
    pathname === "/catalogo" ||
    pathname.startsWith("/inventario/orden-trabajo/") ||
    pathname.startsWith("/proveedores/lotes/") ||
    (pathname.startsWith("/entregas/") && pathname.endsWith("/ticket")) ||
    (pathname.startsWith("/finanzas/arqueos/") && pathname.endsWith("/pdf"))
  ) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-8 pt-[4.5rem] md:p-8">
        {children}
      </main>
    </div>
  );
}

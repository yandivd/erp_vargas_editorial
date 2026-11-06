"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/catalogo") {
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

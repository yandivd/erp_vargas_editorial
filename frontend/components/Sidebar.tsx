"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  ArrowRightLeft,
  BarChart3,
  Book,
  BookOpen,
  FileText,
  HardDrive,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  className?: string;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

type Usuario = {
  username: string;
  rol: string;
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  staff: "Staff",
  usuario: "Usuario",
};

const djangoUrl = (process.env.NEXT_PUBLIC_DJANGO_URL ?? "").replace(/\/+$/, "");
const adminHref = djangoUrl ? `${djangoUrl}/admin/` : "/admin/";

const sections: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: LayoutGrid },
      { href: "/pedidos?en_taller=true", label: "Pedidos (Taller)", icon: BookOpen },
      { href: "/pedidos/tienda", label: "Tienda", icon: Store },
      { href: "/pedidos/entregas", label: "Entregas", icon: Truck },
      { href: "/pedidos/entregados", label: "Historial Entregados", icon: Archive },
      { href: "/pedidos/catalogo", label: "Catálogo", icon: Book },
      { href: "/pedidos/catalogo/pdf", label: "Catálogo PDF", icon: FileText },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/inventario", label: "Inventario", icon: Package },
      { href: "/proveedores", label: "Proveedores", icon: Truck },
      { href: "/compras", label: "Compras", icon: ShoppingCart },
      { href: "/empleados", label: "Nómina", icon: UserRound },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/finanzas/caja", label: "Caja", icon: Wallet },
      { href: "/finanzas/divisas", label: "Divisas (USD)", icon: ArrowRightLeft },
      { href: "/finanzas/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/finanzas/activos", label: "Activos fijos", icon: HardDrive },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: adminHref, label: "Admin", icon: Settings }],
  },
];

function isActive(pathname: string, href: string): boolean {
  const hrefPath = href.split(/[?#]/, 1)[0];

  if (hrefPath === "/") {
    return pathname === "/";
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {sections.map((section, sectionIndex) => (
        <div key={section.label ?? `section-${sectionIndex}`}>
          {section.label ? (
            <div className="px-6 pb-2 pt-5 text-[0.7rem] font-bold uppercase tracking-[1px] text-slate-400">
              {section.label}
            </div>
          ) : null}
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const external = /^https?:\/\//.test(item.href);
            const classes = [
              "flex items-center border-l-[3px] px-6 py-3 text-[0.95rem] font-medium no-underline transition-all",
              active
                ? "border-brand bg-blue-50 font-semibold text-brand"
                : "border-transparent text-muted hover:border-brand hover:bg-blue-50 hover:text-brand",
            ].join(" ");

            if (external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={classes}
                  onClick={onNavigate}
                >
                  <Icon className="mr-3 h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden="true" />
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={classes}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <Icon className="mr-3 h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

function UserProfile({ usuario }: { usuario: Usuario | null }) {
  const router = useRouter();
  const initial = usuario?.username?.charAt(0).toUpperCase() || "U";
  const role = usuario?.rol ? roleLabels[usuario.rol] ?? usuario.rol : "Usuario";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="shrink-0 border-t border-line px-6 py-4">
      <div className="mb-3 flex items-center">
        <div className="mr-2 flex h-[35px] w-[35px] items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[0.85rem] font-bold text-slate-900">
            {usuario?.username ?? "Mi cuenta"}
          </div>
          <div className="text-[0.75rem] text-muted">{role}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-red-300 px-3 py-1.5 text-[0.8rem] font-semibold text-red-600 transition hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Cerrar Sesión
      </button>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex shrink-0 items-center justify-center px-4 py-6">
      <Image
        src="/img/logo1.jpg"
        alt="Vargas Editorial"
        width={260}
        height={120}
        priority
        className="h-auto max-h-[60px] w-full object-contain"
      />
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/bff/auth/me", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { ok?: boolean; data?: Usuario } | null) => {
        if (!cancelled && payload?.ok && payload.data) {
          setUsuario(payload.data);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-center bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.05)] md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mr-2 rounded-md p-1 text-slate-900 transition hover:bg-slate-100"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <span className="font-bold text-slate-900">Vargas Editorial</span>
      </header>

      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-line bg-white md:flex">
        <Brand />
        <nav className="flex-1 overflow-y-auto pb-4">
          <NavLinks pathname={pathname} />
        </nav>
        <UserProfile usuario={usuario} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          />
          <aside className="relative flex h-full w-[280px] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <h2 className="text-lg font-bold text-slate-900">Menú</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-600 transition hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto pb-4">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </nav>
            <UserProfile usuario={usuario} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

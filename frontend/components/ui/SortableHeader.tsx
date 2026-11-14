"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { thClass } from "@/components/dashboard/ui";

type SortableHeaderProps = {
  label: ReactNode;
  sortKey: string;
  defaultDirection?: "asc" | "desc";
  isDefault?: boolean;
  className?: string;
  align?: "left" | "right";
};

export function SortableHeader({
  label,
  sortKey,
  defaultDirection = "asc",
  isDefault = false,
  className = "",
  align = "left",
}: SortableHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("orden") ?? "";
  const isAsc = current === `${sortKey}_asc`;
  const isDesc = current === `${sortKey}_desc`;
  const activeDirection = isAsc
    ? "asc"
    : isDesc
      ? "desc"
      : !current && isDefault
        ? defaultDirection
        : null;
  const nextDirection =
    activeDirection === "asc"
      ? "desc"
      : activeDirection === "desc"
        ? "asc"
        : defaultDirection;

  const params = new URLSearchParams(searchParams.toString());
  params.set("orden", `${sortKey}_${nextDirection}`);
  params.delete("page");

  const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
  const ariaSort =
    activeDirection === "asc"
      ? "ascending"
      : activeDirection === "desc"
        ? "descending"
        : "none";

  return (
    <th
      aria-sort={ariaSort}
      className={`${align === "right" ? thClass.replace("text-left", "text-right") : thClass} ${className}`}
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${
          activeDirection ? "text-ink" : ""
        }`}
      >
        <span>{label}</span>
        {activeDirection === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : activeDirection === "desc" ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </Link>
    </th>
  );
}

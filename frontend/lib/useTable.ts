"use client";
import { useMemo, useState } from "react";

export function useTable<T>(rows: T[], opts: {
  searchKeys: (row: T) => string[];
  filters?: Record<string, (row: T, value: string) => boolean>;
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = opts.pageSize ?? 15;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !opts.searchKeys(row).some((v) => (v || "").toLowerCase().includes(q))) return false;
      for (const [k, v] of Object.entries(filters)) {
        if (!v) continue;
        const fn = opts.filters?.[k];
        if (fn && !fn(row, v)) return false;
      }
      return true;
    });
  }, [rows, search, filters, opts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const setFilter = (k: string, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const setSearchAndReset = (v: string) => { setSearch(v); setPage(1); };

  return { search, setSearch: setSearchAndReset, filters, setFilter, page: safePage, setPage, totalPages, total: filtered.length, start: filtered.length ? (safePage - 1) * pageSize + 1 : 0, end: Math.min(safePage * pageSize, filtered.length), pageRows };
}

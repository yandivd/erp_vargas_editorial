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
  const pageSize = opts.pageSize ?? 20;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !opts.searchKeys(row).some((v) => String(v ?? "").toLowerCase().includes(q))) return false;
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
  const start = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, filtered.length);
  const pageRows = useMemo(() => filtered.slice((safePage - 1) * pageSize, safePage * pageSize), [filtered, safePage, pageSize]);

  const setFilter = (k: string, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const onSearch = (v: string) => { setSearch(v); setPage(1); };
  return { search, setSearch: onSearch, filters, setFilter, total: filtered.length, rows: filtered, page: safePage, setPage, totalPages, start, end, pageRows };
}

"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

export type ColumnFilter = { key: string; label: string; options?: { value: string; label: string }[] };

type Props = {
  search: string; onSearch: (v: string) => void;
  filters: Record<string, string>; onFilter: (key: string, v: string) => void;
  filterDefs: ColumnFilter[];
  total: number;
  page?: number; totalPages?: number; start?: number; end?: number; onPage?: (p: number) => void;
};

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function TableControls({ search, onSearch, filters, onFilter, filterDefs, total, page, totalPages, start, end, onPage }: Props) {
  const hasFilters = search || Object.values(filters).some(Boolean);
  const hasPaging = !!onPage && !!totalPages && totalPages > 1;
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar..." className={`${input} pl-9`} />
        </div>
        {filterDefs.map((f) => (
          <div key={f.key}>
            {f.options ? (
              <select value={filters[f.key] || ""} onChange={(e) => onFilter(f.key, e.target.value)} className={input}>
                <option value="">{f.label}: Todos</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input value={filters[f.key] || ""} onChange={(e) => onFilter(f.key, e.target.value)} placeholder={`${f.label}...`} className={input} />
            )}
          </div>
        ))}
        {hasFilters ? (
          <button type="button" onClick={() => { onSearch(""); filterDefs.forEach((f) => onFilter(f.key, "")); }} className="inline-flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted hover:bg-slate-50"><X className="h-4 w-4" />Limpiar</button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{hasPaging ? `${start}-${end} de ${total}` : `${total} resultado${total === 1 ? "" : "s"}`}</span>
        {hasPaging ? (
          <div className="flex items-center gap-2">
            <button type="button" disabled={(page ?? 1) <= 1} onClick={() => onPage((page ?? 1) - 1)} className="rounded-lg border border-line p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span>Pág. {page} / {totalPages}</span>
            <button type="button" disabled={(page ?? 1) >= (totalPages ?? 1)} onClick={() => onPage((page ?? 1) + 1)} className="rounded-lg border border-line p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

const kpiTones = {
  emerald: "#10b981",
  red: "#ef4444",
  blue: "#3b82f6",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  pink: "#ec4899",
  orange: "#f97316",
  neutral: "#cbd5e1",
} as const;

export type KpiTone = keyof typeof kpiTones;

export function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: KpiTone;
  valueClassName?: string;
}) {
  return (
    <div
      className="relative h-full overflow-hidden rounded-xl border border-line border-t-4 bg-white p-5 transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05)]"
      style={{ borderTopColor: kpiTones[tone] }}
    >
      <div className="mb-2 text-[0.7rem] font-bold uppercase tracking-[1px] text-muted">
        {label}
      </div>
      <div
        className={`text-[1.3rem] font-extrabold leading-none text-ink md:text-[1.6rem] ${valueClassName}`}
      >
        {value}
      </div>
      {sub ? <div className="mt-2 text-[0.72rem] text-muted">{sub}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mb-4 rounded-xl border border-line bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] md:p-6 ${className}`}
    >
      <h4 className="mb-5 flex items-center gap-2.5 text-[1.1rem] font-bold text-ink">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

export function EmptyTableRow({
  colSpan,
  children = "Sin datos",
}: {
  colSpan: number;
  children?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-3 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

export const tableClass = "w-full border-collapse";
export const thClass =
  "whitespace-nowrap border-b-2 border-line px-2 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wide text-muted";
export const tdClass = "border-b border-line px-2 py-2.5 text-[0.85rem]";
export const tableRowClass = "transition-colors hover:bg-slate-50";
export const tableWrapClass = "overflow-x-auto";

export function TypeBadge({ type }: { type: string }) {
  const isIncome = type === "INGRESO";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
        isIncome
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {type}
    </span>
  );
}

export const adviceTones: Record<string, string> = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

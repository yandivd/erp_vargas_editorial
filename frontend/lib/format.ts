import type { DashboardMeta } from "./dashboard";

const numberFormat = new Intl.NumberFormat("es-CU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormat = new Intl.NumberFormat("es-CU", {
  maximumFractionDigits: 0,
});

export function money(value: number | string | null | undefined, currency?: string): string {
  const number = Number(value ?? 0);
  const isUsd = currency === "USD";
  const prefix = isUsd ? "US$" : "$";
  const formatter = isUsd ? integerFormat : numberFormat;
  return `${prefix}${formatter.format(number)}`;
}

export function number(value: number | string | null | undefined): string {
  return numberFormat.format(Number(value ?? 0));
}

export function integer(value: number | string | null | undefined): string {
  return integerFormat.format(Number(value ?? 0));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const parts = String(value).slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const text = String(value);
  const date = formatDate(text);
  const time = text.split("T")[1]?.slice(0, 5);

  return time ? `${date} ${time}` : date;
}

export function periodLabel(meta?: DashboardMeta): string {
  const desde = formatDate(meta?.desde);
  const hasta = formatDate(meta?.hasta);

  if (desde && hasta) {
    return `Del ${desde} al ${hasta}`;
  }

  if (desde) {
    return `Desde ${desde}`;
  }

  if (hasta) {
    return `Hasta ${hasta}`;
  }

  return "Todo el historial";
}

"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DesgloseIngreso,
  FrecuenciaData,
  PedidosMesSerie,
  ProyeccionMes,
  SemanaMovimiento,
  TendenciaMes,
  TipoCliente,
  TopLibro,
} from "@/lib/dashboard";
import { money } from "@/lib/format";

const chartColors = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

const axisTick = { fontSize: 12, fill: "#64748b" };

function EmptyChart({ message = "Sin datos" }: { message?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      {message}
    </div>
  );
}

function tooltipMoney(value: unknown) {
  return money(Number(value ?? 0));
}

export function IncomeBreakdownChart({ data }: { data: DesgloseIngreso[] }) {
  if (!data.length) {
    return <EmptyChart message="Sin ingresos operativos" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="categoria"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell
              key={`${entry.categoria}-${index}`}
              fill={chartColors[index % chartColors.length]}
            />
          ))}
        </Pie>
        <Tooltip formatter={tooltipMoney} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: TendenciaMes[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={axisTick} />
        <YAxis tick={axisTick} width={70} tickFormatter={(value) => money(Number(value))} />
        <Tooltip formatter={tooltipMoney} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="ingresos"
          name="Ingresos"
          stroke="#10b981"
          strokeWidth={2}
          fill="rgba(16,185,129,.12)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="gastos"
          name="Gastos"
          stroke="#ef4444"
          strokeWidth={2}
          fill="rgba(239,68,68,.10)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ProjectionChart({ data }: { data: ProyeccionMes[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={axisTick} />
        <YAxis tick={axisTick} width={70} tickFormatter={(value) => money(Number(value))} />
        <Tooltip formatter={tooltipMoney} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="ingresos"
          name="Ingresos proyectados"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="gastos"
          name="Gastos proyectados"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeeklyChart({ data }: { data: SemanaMovimiento[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="semana" tick={axisTick} />
        <YAxis tick={axisTick} width={70} tickFormatter={(value) => money(Number(value))} />
        <Tooltip formatter={tooltipMoney} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopBooksChart({ data }: { data: TopLibro[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tick={axisTick} />
        <YAxis
          dataKey="titulo"
          type="category"
          width={130}
          tick={axisTick}
          tickFormatter={(value: string) =>
            value.length > 24 ? `${value.slice(0, 24)}…` : value
          }
        />
        <Tooltip />
        <Bar dataKey="total" name="Pedidos" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyOrdersChart({
  labels,
  series,
}: {
  labels: string[];
  series: PedidosMesSerie[];
}) {
  if (!labels.length || !series.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={labels.map((label, index) => {
          const row: Record<string, string | number> = { mes: label };
          series.forEach((item) => {
            row[item.label] = item.data[index] ?? 0;
          });
          return row;
        })}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={axisTick} />
        <YAxis tick={axisTick} width={40} allowDecimals={false} />
        <Tooltip />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
        {series.map((item, index) => (
          <Line
            key={item.label}
            type="monotone"
            dataKey={item.label}
            name={item.label}
            stroke={chartColors[index % chartColors.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ClientTypeChart({ data }: { data: TipoCliente[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="tipo"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell
              key={`${entry.tipo}-${index}`}
              fill={chartColors[index % chartColors.length]}
            />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ClientFrequencyChart({ data }: { data: FrecuenciaData }) {
  if (!data.labels.length || !data.data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data.labels.map((label, index) => ({
          label,
          clientes: data.data[index] ?? 0,
        }))}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={axisTick} />
        <YAxis tick={axisTick} width={40} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="clientes" name="Clientes" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

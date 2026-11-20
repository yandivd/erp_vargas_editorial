"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
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
  ComportamientoPedidoMes,
  ComposicionIngresos,
  DesgloseIngreso,
  DistribucionSellos,
  FrecuenciaData,
  IngresoGastoMes,
  MapaCalorDia,
  PedidosMesSerie,
  ProyeccionMes,
  SemanaMovimiento,
  TendenciaFidelidad,
  TendenciaMes,
  TendenciaMensual,
  TicketMedioFidelidad,
  TiempoEstado,
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

export function IncomeBreakdownChart({
  data,
  emptyMessage = "Sin ingresos operativos",
}: {
  data: DesgloseIngreso[];
  emptyMessage?: string;
}) {
  if (!data.length) {
    return <EmptyChart message={emptyMessage} />;
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

export function MonthlyFinanceChart({ data }: { data: IngresoGastoMes[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={axisTick} />
        <YAxis tick={axisTick} width={70} tickFormatter={(value) => money(Number(value))} />
        <Tooltip formatter={tooltipMoney} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendProjectionChart({ data }: { data: TendenciaMensual[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  const chartData = data.map((item) => {
    const isProjected = item.tipo === "proyeccion";
    return {
      mes: item.mes,
      ingresos: isProjected ? null : item.ingresos,
      gastos: isProjected ? null : item.gastos,
      ingresos_proyectados: isProjected ? item.ingresos : null,
      gastos_proyectados: isProjected ? item.gastos : null,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={axisTick} />
        <YAxis tick={axisTick} width={70} tickFormatter={(value) => money(Number(value))} />
        <Tooltip formatter={tooltipMoney} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="ingresos"
          name="Ingresos"
          stroke="#10b981"
          strokeWidth={2}
          connectNulls
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="gastos"
          name="Gastos"
          stroke="#ef4444"
          strokeWidth={2}
          connectNulls
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="ingresos_proyectados"
          name="Ingresos proyectados"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="6 4"
          connectNulls
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="gastos_proyectados"
          name="Gastos proyectados"
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="6 4"
          connectNulls
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeekdayIncomeChart({ data }: { data: MapaCalorDia[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dia" tick={axisTick} />
        <YAxis tick={axisTick} width={70} tickFormatter={(value) => money(Number(value))} />
        <Tooltip formatter={tooltipMoney} />
        <Bar dataKey="total" name="Ingresos" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OrderBehaviorChart({
  data,
}: {
  data: ComportamientoPedidoMes[];
}) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={axisTick} />
        <YAxis tick={axisTick} width={40} allowDecimals={false} />
        <Tooltip />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="pedidos" name="Pedidos" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="entregados" name="Entregados" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type TimeUnit = "horas" | "dias" | "semanas";

const timeUnits: Record<
  TimeUnit,
  { label: string; shortLabel: string; hours: number }
> = {
  horas: { label: "Horas", shortLabel: "h", hours: 1 },
  dias: { label: "Días", shortLabel: "d", hours: 24 },
  semanas: { label: "Semanas", shortLabel: "sem", hours: 168 },
};

export function BottleneckFunnelChart({ data }: { data: TiempoEstado[] }) {
  const [unit, setUnit] = useState<TimeUnit>("horas");

  if (!data.length) {
    return <EmptyChart />;
  }

  const selectedUnit = timeUnits[unit];
  const values = data.map((item) => item.promedio_horas);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const chartData = data.map((item) => {
    const ratio = max === min ? 0 : (item.promedio_horas - min) / (max - min);
    const r = Math.round(16 + (239 - 16) * ratio);
    const g = Math.round(185 + (68 - 185) * ratio);
    const b = Math.round(129 + (68 - 129) * ratio);
    return {
      name: item.estado,
      estado: item.estado,
      value: Math.max(item.promedio_horas / selectedUnit.hours, 0.0001),
      pedidos: item.pedidos,
      promedio_horas: item.promedio_horas,
      fill: `rgb(${r}, ${g}, ${b})`,
    };
  });

  const thresholdHours = 7 * 24;
  const thresholdInUnit = thresholdHours / selectedUnit.hours;
  const maxVal = Math.max(...chartData.map((d) => d.value), thresholdInUnit);
  const pct = maxVal > 0 ? (thresholdInUnit / maxVal) * 100 : 0;
  const half = Math.min(pct / 2, 50);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(timeUnits) as TimeUnit[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setUnit(option)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                unit === option
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-muted hover:border-brand hover:bg-blue-50 hover:text-brand"
              }`}
            >
              {timeUnits[option].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-red-500">
          <span className="inline-block w-4 border-t-2 border-dashed border-red-500" />
          <span>Límite 7 días</span>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          className="pointer-events-none absolute bottom-3 top-3 z-10 border-l-2 border-dashed border-red-500/80"
          style={{ left: `${50 - half}%` }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-3 top-3 z-10 border-l-2 border-dashed border-red-500/80"
          style={{ left: `${50 + half}%` }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded bg-red-500/90 px-1 text-[10px] font-semibold leading-4 text-white"
          style={{ left: `${50 + half}%` }}
        >
          7d
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <Tooltip
              formatter={(value, _name, props) => {
                const payload = props?.payload as
                  | { pedidos?: number }
                  | undefined;
                const suffix =
                  payload?.pedidos != null
                    ? ` · ${payload.pedidos} pedidos`
                    : "";
                return [
                  `${Number(value ?? 0).toFixed(1)} ${selectedUnit.shortLabel}${suffix}`,
                  "Tiempo promedio",
                ];
              }}
              labelFormatter={(_, payload) =>
                ((payload?.[0]?.payload as { estado?: string } | undefined)
                  ?.estado ?? "")
              }
            />
            <Funnel dataKey="value" data={chartData} isAnimationActive>
              <LabelList
                dataKey="estado"
                position="right"
                fill="#64748b"
                stroke="none"
                fontSize={11}
                formatter={(value: unknown) => {
                  const text = String(value ?? "");
                  return text.length > 16 ? `${text.slice(0, 16)}…` : text;
                }}
              />
              {chartData.map((entry, index) => (
                <Cell key={`${entry.estado}-${index}`} fill={entry.fill} />
              ))}
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
    </div>
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

function formatMesCorto(value: unknown): string {
  const [year, month] = String(value ?? "").split("-");
  if (!year || !month) {
    return String(value ?? "");
  }
  return `${month}/${year.slice(2)}`;
}

function segmentoLabel(tipo: string): string {
  if (tipo === "Activos") {
    return "Clientes Activos";
  }
  if (tipo === "Inactivos") {
    return "Clientes Inactivos";
  }
  return tipo;
}

export function DistribucionSellosChart({
  data,
}: {
  data: DistribucionSellos[];
}) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="sellos" tick={axisTick} />
        <YAxis tick={axisTick} width={40} allowDecimals={false} />
        <Tooltip />
        <Bar
          dataKey="cantidad"
          name="Tarjetas"
          fill="#3b82f6"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ComposicionIngresosChart({
  data,
}: {
  data: ComposicionIngresos[];
}) {
  const chartData = data.map((item) => ({
    ...item,
    tipo: segmentoLabel(item.tipo),
  }));
  const total = chartData.reduce((acc, item) => acc + Number(item.total || 0), 0);

  if (!chartData.length || total <= 0) {
    return <EmptyChart message="Sin ingresos en el período" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="total"
          nameKey="tipo"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`${entry.tipo}-${index}`}
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

export function TicketMedioFidelidadChart({
  data,
}: {
  data: TicketMedioFidelidad[];
}) {
  const chartData = data.map((item) => ({
    ...item,
    tipo: segmentoLabel(item.tipo),
  }));

  if (!chartData.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="tipo" tick={axisTick} />
        <YAxis
          tick={axisTick}
          width={70}
          tickFormatter={(value) => money(Number(value))}
        />
        <Tooltip formatter={tooltipMoney} />
        <Bar dataKey="ticket" name="Ticket medio" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`${entry.tipo}-${index}`}
              fill={chartColors[index % chartColors.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TendenciaFidelidadChart({
  data,
}: {
  data: TendenciaFidelidad[];
}) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={axisTick} tickFormatter={formatMesCorto} />
        <YAxis
          tick={axisTick}
          width={70}
          tickFormatter={(value) => money(Number(value))}
        />
        <Tooltip formatter={tooltipMoney} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="activos"
          name="Clientes Activos"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="inactivos"
          name="Clientes Inactivos"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

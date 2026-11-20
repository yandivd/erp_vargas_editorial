"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
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

export function BottleneckFunnelChart({ data }: { data: TiempoEstado[] }) {
  if (!data.length) {
    return <EmptyChart />;
  }

  const chartData = data.map((item) => {
    const promedioDias = item.promedio_horas / 24;
    let fill = "#10b981";
    if (promedioDias > 14) {
      fill = "#ef4444";
    } else if (promedioDias >= 7) {
      fill = "#f59e0b";
    }
    return {
      ...item,
      promedio_dias: promedioDias,
      tiempoLabel: `${promedioDias.toFixed(1)} d`,
      fill,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 56, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          tick={axisTick}
          tickFormatter={(value) => `${Number(value ?? 0).toFixed(0)}d`}
        />
        <YAxis
          dataKey="estado"
          type="category"
          width={140}
          tick={axisTick}
          tickFormatter={(value: string) =>
            value.length > 22 ? `${value.slice(0, 22)}…` : value
          }
        />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as {
              estado: string;
              promedio_dias: number;
            };
            return (
              <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-sm">
                {`Estado: ${p.estado} | Tiempo Promedio: ${p.promedio_dias.toFixed(1)} días`}
              </div>
            );
          }}
        />
        <ReferenceLine x={7} stroke="#ef4444" strokeDasharray="4 4" />
        <Bar dataKey="promedio_dias" name="Tiempo promedio (días)" radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="tiempoLabel"
            position="right"
            fill="#475569"
            fontSize={11}
          />
          {chartData.map((entry, index) => (
            <Cell key={`${entry.estado}-${index}`} fill={entry.fill} />
          ))}
        </Bar>
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

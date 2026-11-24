"use client";

import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ClientesTab from "@/components/dashboard/ClientesTab";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardTabSkeleton from "@/components/dashboard/DashboardTabSkeleton";
import FidelidadTab from "@/components/dashboard/FidelidadTab";
import LeadsTab from "@/components/dashboard/LeadsTab";
import ProduccionTab from "@/components/dashboard/ProduccionTab";
import ResumenTab from "@/components/dashboard/ResumenTab";
import { apiFetch } from "@/lib/api";
import {
  DASHBOARD_TABS,
  type DashboardClientes,
  type DashboardData,
  type DashboardFidelidad,
  type DashboardLeads,
  type DashboardMeta,
  type DashboardProduccion,
  type DashboardResumen,
  type DashboardTab,
  isDashboardTab,
} from "@/lib/dashboard";

type DashboardTabsClientProps = {
  tab: DashboardTab;
  desde: string;
  hasta: string;
  meta: DashboardMeta;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const PREFETCH_TABS = DASHBOARD_TABS.map((item) => item.id).filter(
  (id) => id !== "leads",
);

function cacheKey(tab: DashboardTab, desde: string, hasta: string): string {
  return `${tab}|${desde}|${hasta}`;
}

function tabHref(tab: DashboardTab, desde: string, hasta: string): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (desde) {
    params.set("desde", desde);
  }
  if (hasta) {
    params.set("hasta", hasta);
  }
  return `/?${params.toString()}`;
}

function dataMeta(data: DashboardData): Partial<DashboardMeta> {
  if (data && typeof data === "object" && "meta" in data) {
    return (data as { meta: DashboardMeta }).meta;
  }
  return {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudieron cargar los datos del dashboard.";
}

export default function DashboardTabsClient({
  tab,
  desde,
  hasta,
  meta,
}: DashboardTabsClientProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(tab);
  const [filters] = useState({ desde, hasta });
  const [dataByKey, setDataByKey] = useState<Record<string, DashboardData>>({});
  const [currentMeta, setCurrentMeta] = useState<DashboardMeta>(meta);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(new Map<string, Promise<DashboardData>>());

  const loadTab = useCallback(
    async (target: DashboardTab, targetDesde: string, targetHasta: string) => {
      const key = cacheKey(target, targetDesde, targetHasta);
      const pending = inFlight.current.get(key);
      if (pending) {
        return pending;
      }

      const query = new URLSearchParams();
      if (targetDesde) {
        query.set("desde", targetDesde);
      }
      if (targetHasta) {
        query.set("hasta", targetHasta);
      }
      const queryString = query.toString();

      const request = apiFetch<DashboardData>(
        `dashboard/${target}${queryString ? `?${queryString}` : ""}`,
      )
        .then((data) => {
          setDataByKey((previous) => ({ ...previous, [key]: data }));
          setCurrentMeta((previous) => ({ ...previous, ...dataMeta(data) }));
          return data;
        })
        .finally(() => {
          inFlight.current.delete(key);
        });

      inFlight.current.set(key, request);
      return request;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    loadTab(tab, desde, hasta).catch((requestError) => {
      if (!cancelled) {
        setError(errorMessage(requestError));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tab, desde, hasta, loadTab]);

  useEffect(() => {
    const targets = PREFETCH_TABS.filter((id) => id !== activeTab);
    const prefetch = () => {
      targets.forEach((id) => {
        void loadTab(id, filters.desde, filters.hasta).catch(() => undefined);
      });
    };

    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(prefetch);
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(prefetch, 300);
    return () => window.clearTimeout(handle);
  }, [activeTab, filters.desde, filters.hasta, loadTab]);

  const handleTabSelect = (
    target: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();
    if (!isDashboardTab(target)) {
      return;
    }

    setActiveTab(target);
    setError(null);
    window.history.replaceState(
      null,
      "",
      tabHref(target, filters.desde, filters.hasta),
    );

    void loadTab(target, filters.desde, filters.hasta).catch((requestError) => {
      setError(errorMessage(requestError));
    });
  };

  const currentData = dataByKey[
    cacheKey(activeTab, filters.desde, filters.hasta)
  ];
  const isLoading = !currentData && !error;

  return (
    <div>
      <DashboardHeader
        tab={activeTab}
        desde={filters.desde}
        hasta={filters.hasta}
        meta={currentMeta}
        onTabSelect={handleTabSelect}
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el dashboard.</strong>
            <div>{error}</div>
          </div>
        </div>
      ) : null}

      {isLoading ? <DashboardTabSkeleton tab={activeTab} /> : null}
      {currentData ? renderTab(activeTab, currentData) : null}
    </div>
  );
}

function renderTab(tab: DashboardTab, data: DashboardData) {
  switch (tab) {
    case "resumen":
      return <ResumenTab data={data as DashboardResumen} />;
    case "produccion":
      return <ProduccionTab data={data as DashboardProduccion} />;
    case "clientes":
      return <ClientesTab data={data as DashboardClientes} />;
    case "fidelidad":
      return <FidelidadTab data={data as DashboardFidelidad} />;
    case "leads":
      return <LeadsTab data={data as DashboardLeads} />;
    default:
      return null;
  }
}

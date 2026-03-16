"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AlertsActiveList } from "@/components/alerts/alerts-active-list";
import { AlertsFilterBar } from "@/components/alerts/alerts-filter-bar";
import { AlertsHistoryList } from "@/components/alerts/alerts-history-list";
import { ReportExportActions } from "@/components/shared/report-export-actions";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type {
  AlertSeverity,
  AlertSource,
  ProductionAlert,
  ProductionSnapshot,
  SectorKey,
} from "@/domain/production/types";
import {
  useProductionSimulation,
  useProductionSimulationActions,
} from "@/hooks/use-production-simulation";
import { formatDateTimeShort } from "@/lib/formatters";
import { exportAlertsCsv, exportAlertsPdf } from "@/lib/reporting";
import { getAlertSeverityMeta, getSectorLabel } from "@/lib/status-meta";

type AlertCollectionState = "ativos" | "historico" | "todos";

export function AlertsView() {
  const snapshot = useProductionSimulation();
  const actions = useProductionSimulationActions();
  const searchParams = useSearchParams();
  const querySector = searchParams.get("sector");
  const queryOrderNumber = searchParams.get("orderNumber");
  const selectedAlertId = searchParams.get("alertId");
  const sectorFromQuery =
    querySector && ["corte", "costura", "acabamento", "expedicao"].includes(querySector)
      ? (querySector as SectorKey)
      : "todos";
  const initialStateFilter =
    selectedAlertId &&
    snapshot.alertHistory.some((alert) => alert.id === selectedAlertId)
      ? "historico"
      : "ativos";
  const [searchQuery, setSearchQuery] = useState(() => queryOrderNumber ?? "");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "todas">("todas");
  const [sectorFilter, setSectorFilter] = useState<SectorKey | "todos">(
    sectorFromQuery,
  );
  const [sourceFilter, setSourceFilter] = useState<AlertSource | "todas">("todas");
  const [stateFilter, setStateFilter] = useState<AlertCollectionState>(
    initialStateFilter,
  );
  const availableSectors = useMemo(
    () => snapshot.sectors.map((sector) => sector.key),
    [snapshot.sectors],
  );

  const filteredActiveAlerts = useMemo(
    () =>
      filterAlerts(snapshot.alerts, {
        searchQuery,
        severityFilter,
        sectorFilter,
        sourceFilter,
      }),
    [searchQuery, sectorFilter, severityFilter, snapshot.alerts, sourceFilter],
  );

  const filteredHistoryAlerts = useMemo(
    () =>
      filterAlerts(snapshot.alertHistory, {
        searchQuery,
        severityFilter,
        sectorFilter,
        sourceFilter,
      }),
    [searchQuery, sectorFilter, severityFilter, snapshot.alertHistory, sourceFilter],
  );

  const highestSeverityAlert = filteredActiveAlerts[0];
  const highestSeverityMeta = highestSeverityAlert
    ? getAlertSeverityMeta(highestSeverityAlert.severity)
    : { label: "Estavel", tone: "success" as const };
  const acknowledgedToday = snapshot.alertHistory.filter(
    (alert) =>
      alert.acknowledgedAt &&
      new Date(alert.acknowledgedAt).toDateString() === new Date(snapshot.currentTime).toDateString(),
  ).length;
  const criticalBacklog = filteredActiveAlerts.filter((alert) => alert.severity === "high").length;

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    severityFilter !== "todas" ||
    sectorFilter !== "todos" ||
    sourceFilter !== "todas" ||
    stateFilter !== "ativos";

  const showActive = stateFilter === "ativos" || stateFilter === "todos";
  const showHistory = stateFilter === "historico" || stateFilter === "todos";

  return (
    <AppShell
      eyebrow="Central de alertas"
      title="Triagem e historico operacional"
      subtitle="Central dedicada para criticidade, leitura confirmada e rastreabilidade dos desvios que impactam prazo, qualidade e disponibilidade da operacao."
      meta={
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            {filteredActiveAlerts.length} alertas ativos
          </div>
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            Atualizado em {formatDateTimeShort(snapshot.currentTime)}
          </div>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportExportActions
            onExportCsv={() => exportAlertsCsv(filteredActiveAlerts, filteredHistoryAlerts)}
            onExportPdf={() => exportAlertsPdf(filteredActiveAlerts, filteredHistoryAlerts)}
          />
          <StatusBadge label={highestSeverityMeta.label} tone={highestSeverityMeta.tone} />
        </div>
      }
    >
      <div className="space-y-4">
        <section className="grid gap-4 lg:grid-cols-3">
          <SummaryTile
            label="Criticos pendentes"
            value={String(criticalBacklog).padStart(2, "0")}
            caption="Alertas de alta criticidade ainda ativos"
          />
          <SummaryTile
            label="Leituras confirmadas"
            value={String(acknowledgedToday).padStart(2, "0")}
            caption="Alertas arquivados manualmente no turno"
          />
          <SummaryTile
            label="Setor dominante"
            value={
              highestSeverityAlert?.sector === "fabrica"
                ? "Fabrica"
                : highestSeverityAlert
                  ? getSectorLabel(highestSeverityAlert.sector)
                  : "Controlado"
            }
            caption="Origem do desvio mais relevante"
          />
        </section>

        <SectionCard
          title="Filtros de triagem"
          description="Refine a fila por severidade, setor, origem e estado do evento."
        >
          <AlertsFilterBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
            sectorFilter={sectorFilter}
            onSectorFilterChange={setSectorFilter}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            stateFilter={stateFilter}
            onStateFilterChange={setStateFilter}
            activeCount={filteredActiveAlerts.length}
            historyCount={filteredHistoryAlerts.length}
            onReset={() => {
              setSearchQuery("");
              setSeverityFilter("todas");
              setSectorFilter("todos");
              setSourceFilter("todas");
              setStateFilter("ativos");
            }}
            hasActiveFilters={hasActiveFilters}
            availableSectors={availableSectors}
          />
        </SectionCard>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          {showActive ? (
            <AlertsActiveList
              alerts={filteredActiveAlerts}
              selectedAlertId={selectedAlertId}
              onAcknowledge={(alertId) => {
                const alert = snapshot.alerts.find((item) => item.id === alertId);

                if (!alert) {
                  return;
                }

                actions.acknowledgeAlert({
                  alertId,
                  acknowledgedBy: resolveAlertOwner(alert, snapshot),
                });
              }}
            />
          ) : null}

          {showHistory ? (
            <AlertsHistoryList
              alerts={filteredHistoryAlerts}
              selectedAlertId={selectedAlertId}
            />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function filterAlerts(
  alerts: ProductionAlert[],
  filters: {
    searchQuery: string;
    severityFilter: AlertSeverity | "todas";
    sectorFilter: SectorKey | "todos";
    sourceFilter: AlertSource | "todas";
  },
) {
  const normalizedQuery = filters.searchQuery.trim().toLowerCase();

  return [...alerts]
    .filter((alert) => {
      if (filters.severityFilter !== "todas" && alert.severity !== filters.severityFilter) {
        return false;
      }

      if (filters.sectorFilter !== "todos" && alert.sector !== filters.sectorFilter) {
        return false;
      }

      if (filters.sourceFilter !== "todas" && alert.source !== filters.sourceFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [alert.title, alert.description, alert.orderNumber ?? "", alert.sector]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort(compareAlertsByPriority);
}

function compareAlertsByPriority(left: ProductionAlert, right: ProductionAlert) {
  const severityRank = {
    high: 0,
    medium: 1,
    info: 2,
  } as const;

  const bySeverity = severityRank[left.severity] - severityRank[right.severity];

  if (bySeverity !== 0) {
    return bySeverity;
  }

  const leftTimestamp = left.resolvedAt ?? left.acknowledgedAt ?? left.timestamp;
  const rightTimestamp = right.resolvedAt ?? right.acknowledgedAt ?? right.timestamp;

  return new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime();
}

function resolveAlertOwner(
  alert: ProductionAlert,
  snapshot: ProductionSnapshot,
) {
  if (alert.orderNumber) {
    const order = snapshot.orders.find((item) => item.number === alert.orderNumber);
    const line = order
      ? snapshot.lines.find((item) => item.id === order.lineId)
      : undefined;
    const supervisor = line
      ? snapshot.operators.find((item) => item.id === line.supervisorId)
      : undefined;

    if (supervisor) {
      return supervisor.name;
    }
  }

  if (alert.sector !== "fabrica") {
    const sectorLine = snapshot.lines.find((line) => line.sector === alert.sector);
    const supervisor = sectorLine
      ? snapshot.operators.find((operator) => operator.id === sectorLine.supervisorId)
      : undefined;

    if (supervisor) {
      return supervisor.name;
    }
  }

  return "Supervisao do turno";
}

function SummaryTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-[26px] border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
      <p className="text-sm text-[color:var(--muted)]">{label}</p>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{caption}</p>
    </div>
  );
}

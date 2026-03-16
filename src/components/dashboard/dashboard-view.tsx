"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { AlertList } from "@/components/dashboard/alert-list";
import { FactoryStatusBanner } from "@/components/dashboard/factory-status-banner";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OrdersOverviewTable } from "@/components/dashboard/orders-overview-table";
import { ProcessLifecycleSummary } from "@/components/dashboard/process-lifecycle-summary";
import { ProductionTrendChart } from "@/components/dashboard/production-trend-chart";
import { SectorMonitoringGrid } from "@/components/dashboard/sector-monitoring-grid";
import { ReportExportActions } from "@/components/shared/report-export-actions";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useProductionSimulation } from "@/hooks/use-production-simulation";
import {
  formatCompactNumber,
  formatDateTimeShort,
  formatPercentage,
} from "@/lib/formatters";
import { buildSectorsHref } from "@/lib/navigation";
import { exportDashboardCsv, exportDashboardPdf } from "@/lib/reporting";
import { getOrderStatusMeta, getSectorStatusMeta } from "@/lib/status-meta";
import {
  Activity,
  GaugeCircle,
  PackageOpen,
  TriangleAlert,
  TrendingUp,
  Users,
} from "lucide-react";

export function DashboardView() {
  const snapshot = useProductionSimulation();

  const activeOrders = snapshot.orders.filter(
    (order) => order.status !== "concluida",
  );
  const delayedOrders = snapshot.orders.filter(
    (order) => order.status === "atrasada" || order.status === "parada",
  );
  const generalStatus =
    snapshot.alerts.some((alert) => alert.severity === "high")
      ? "Atencao operacional"
      : "Operacao estavel";
  const generalTone = snapshot.alerts.some((alert) => alert.severity === "high")
    ? "warning"
    : "success";
  const leadingSector = [...snapshot.sectors].sort(
    (left, right) => right.efficiency - left.efficiency,
  )[0];
  const bottleneckSector = [...snapshot.sectors].sort(
    (left, right) => left.efficiency - right.efficiency,
  )[0];

  return (
    <AppShell
      eyebrow="Monitoramento da producao"
      title="Dashboard industrial da Rosa Maria"
      subtitle="Visao executiva e operacional do chao de fabrica textil com KPIs do turno, andamento das ordens, alertas ativos e simulacao controlada em tempo real."
      meta={
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            <span className="status-pulse h-2.5 w-2.5 rounded-full bg-[color:var(--success)]" />
            Simulacao online
          </div>
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            Atualizado em {formatDateTimeShort(snapshot.currentTime)}
          </div>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportExportActions
            onExportCsv={() => exportDashboardCsv(snapshot)}
            onExportPdf={() => exportDashboardPdf(snapshot)}
          />
          <StatusBadge
            label={generalStatus}
            tone={generalTone}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <FactoryStatusBanner snapshot={snapshot} />
        <ProcessLifecycleSummary stages={snapshot.processStages} />

        <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              title="Producao do dia"
              value={formatCompactNumber(snapshot.dailyProduced)}
              caption={`Meta ${formatCompactNumber(snapshot.dailyTarget)} pecas`}
              trend={`${
                snapshot.dailyProduced >= snapshot.dailyTarget * 0.82
                  ? "Ritmo consistente"
                  : "Abaixo do ritmo ideal"
              }`}
              icon={PackageOpen}
              tone={snapshot.dailyProduced >= snapshot.dailyTarget * 0.82 ? "success" : "warning"}
              progress={Math.min((snapshot.dailyProduced / snapshot.dailyTarget) * 100, 100)}
            />
            <MetricCard
              title="Meta x realizado"
              value={formatPercentage(
                snapshot.dailyProduced / snapshot.dailyTarget,
              )}
              caption="Atingimento consolidado do turno"
              trend={`${formatCompactNumber(
                snapshot.dailyTarget - snapshot.dailyProduced,
              )} pecas para a meta`}
              icon={TrendingUp}
              tone="info"
              progress={Math.min((snapshot.dailyProduced / snapshot.dailyTarget) * 100, 100)}
            />
            <MetricCard
              title="Eficiencia media"
              value={formatPercentage(snapshot.projectedCompletion / 100)}
              caption="Projecao de fechamento do dia"
              trend={`${leadingSector.name} lidera com ${formatPercentage(
                leadingSector.efficiency / 100,
              )}`}
              icon={GaugeCircle}
              tone="success"
              progress={snapshot.projectedCompletion}
            />
            <MetricCard
              title="Alertas ativos"
              value={String(snapshot.alerts.length).padStart(2, "0")}
              caption={`${delayedOrders.length} ordens exigem atencao`}
              trend={`${bottleneckSector.name} e o gargalo atual`}
              icon={TriangleAlert}
              tone={snapshot.alerts.length > 2 ? "warning" : "info"}
              progress={Math.min((snapshot.alerts.length / 5) * 100, 100)}
            />
          </div>

          <SectionCard
            title="Radar operacional"
            description="Indicadores instantaneos do turno para tomada de decisao da supervisao."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/8 bg-white/4 p-4">
                <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <Users className="h-4 w-4 text-[color:var(--accent)]" />
                  Operadores conectados
                </div>
                <p className="mt-4 text-3xl font-semibold">
                  {snapshot.connectedOperators}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Distribuidos entre 4 setores produtivos.
                </p>
              </div>
              <div className="rounded-[26px] border border-white/8 bg-white/4 p-4">
                <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <Activity className="h-4 w-4 text-[color:var(--warning)]" />
                  Paradas acumuladas
                </div>
                <p className="mt-4 text-3xl font-semibold">
                  {snapshot.downtimeMinutes} min
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Inclui microparadas e ajustes de setup.
                </p>
              </div>
              <div className="rounded-[26px] border border-white/8 bg-white/4 p-4">
                <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <TriangleAlert className="h-4 w-4 text-[color:var(--danger)]" />
                  Taxa de defeitos
                </div>
                <p className="mt-4 text-3xl font-semibold">
                  {formatPercentage(snapshot.defectRate / 100)}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Meta interna de qualidade: 1,80%.
                </p>
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <ProductionTrendChart points={snapshot.hourlyProduction} />
          <AlertList alerts={snapshot.alerts} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <SectorMonitoringGrid sectors={snapshot.sectors} />
          <SectionCard
            title="Ordens em andamento"
            description="Resumo das OPs atualmente circulando entre os setores produtivos."
            action={
              <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)]">
                {activeOrders.length} OPs ativas
              </div>
            }
          >
            <div className="space-y-3">
              {activeOrders.slice(0, 4).map((order) => {
                const statusMeta = getOrderStatusMeta(order.status);
                const sectorMeta = getSectorStatusMeta(
                  snapshot.sectors.find(
                    (sector) => sector.key === order.currentSector,
                  )?.status ?? "operando",
                );

                return (
                  <Link
                    key={order.id}
                    href={buildSectorsHref({
                      sector: order.currentSector,
                      orderId: order.id,
                    })}
                    className="block rounded-[24px] border border-white/8 bg-white/4 p-4 transition-colors hover:border-[color:var(--accent)] hover:bg-white/6"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                            {order.number}
                          </p>
                          <StatusBadge
                            label={statusMeta.label}
                            tone={statusMeta.tone}
                          />
                        </div>
                        <h4 className="mt-2 text-base font-medium">
                          {order.productName}
                        </h4>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {order.line} - {formatCompactNumber(order.producedQuantity)} de{" "}
                          {formatCompactNumber(order.plannedQuantity)} pecas
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          label={sectorMeta.label}
                          tone={sectorMeta.tone}
                        />
                      </div>
                    </div>
                    <div className="mt-4 h-2.5 rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6a6,#77d7d3)]"
                        style={{
                          width: `${Math.max(
                            (order.producedQuantity / order.plannedQuantity) * 100,
                            4,
                          )}%`,
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>
        </section>

        <OrdersOverviewTable orders={snapshot.orders} />
      </div>
    </AppShell>
  );
}


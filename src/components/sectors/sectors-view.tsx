"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, ArrowRight, GaugeCircle, TriangleAlert, Wrench } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SectorLineBoard } from "@/components/sectors/sector-line-board";
import { SectorMachineGrid } from "@/components/sectors/sector-machine-grid";
import { SectorOrdersQueue } from "@/components/sectors/sector-orders-queue";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { SectorKey } from "@/domain/production/types";
import { useProductionSimulation } from "@/hooks/use-production-simulation";
import { formatCompactNumber, formatDateTimeShort, formatPercentage } from "@/lib/formatters";
import { buildAlertsHref, buildOrdersHref } from "@/lib/navigation";
import { buildSectorInsights } from "@/lib/sector-insights";
import { getSectorLabel, getSectorStatusMeta } from "@/lib/status-meta";

const sectorKeys: SectorKey[] = ["corte", "costura", "acabamento", "expedicao"];

export function SectorsView() {
  const snapshot = useProductionSimulation();
  const searchParams = useSearchParams();
  const insights = useMemo(() => buildSectorInsights(snapshot), [snapshot]);
  const selectedOrderId = searchParams.get("orderId");
  const querySector = searchParams.get("sector");
  const orderSector = selectedOrderId
    ? snapshot.orders.find((order) => order.id === selectedOrderId)?.currentSector
    : undefined;
  const [selectedSector, setSelectedSector] = useState<SectorKey>(() =>
    sectorKeys.includes((querySector as SectorKey) ?? "costura")
      ? (querySector as SectorKey)
      : orderSector ?? insights[0]?.key ?? "costura",
  );

  const selectedInsight =
    insights.find((insight) => insight.key === selectedSector) ?? insights[0];

  if (!selectedInsight) {
    return null;
  }

  const statusMeta = getSectorStatusMeta(selectedInsight.status);
  const machinesInAttention = selectedInsight.machines.filter(
    (machine) => machine.status === "ajuste" || machine.status === "parada",
  ).length;
  const selectedSectorAlerts = snapshot.alerts.filter(
    (alert) => alert.sector === selectedInsight.key,
  );

  return (
    <AppShell
      eyebrow="Monitoramento por setor"
      title="Drill-down operacional"
      subtitle="Leitura dedicada de corte, costura, acabamento e expedicao com linhas, maquinas, gargalos e fila de ordens conectadas ao mesmo motor de simulacao."
      meta={
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            {selectedInsight.lines.length} linhas monitoradas
          </div>
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            Atualizado em {formatDateTimeShort(snapshot.currentTime)}
          </div>
        </div>
      }
      actions={<StatusBadge label={statusMeta.label} tone={statusMeta.tone} />}
    >
      <div className="space-y-4">
        <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <SectionCard
            title="Selecao de setor"
            description="Acesse a operacao detalhada por etapa e navegue para a carteira de ordens ou central de alertas."
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildOrdersHref({ sector: selectedInsight.key })}
                  className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
                >
                  Abrir ordens do setor
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={buildAlertsHref({ sector: selectedInsight.key })}
                  className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
                >
                  Ver alertas do setor
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {sectorKeys.map((sectorKey) => {
                const insight = insights.find((item) => item.key === sectorKey);

                if (!insight) {
                  return null;
                }

                const itemStatusMeta = getSectorStatusMeta(insight.status);
                const isSelected = insight.key === selectedInsight.key;

                return (
                  <button
                    key={sectorKey}
                    type="button"
                    onClick={() => setSelectedSector(sectorKey)}
                    className={`rounded-[26px] border p-5 text-left transition-colors ${
                      isSelected
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                        : "border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/6"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          {sectorKey}
                        </p>
                        <h3 className="mt-2 text-lg font-medium">
                          {getSectorLabel(sectorKey)}
                        </h3>
                      </div>
                      <StatusBadge
                        label={itemStatusMeta.label}
                        tone={itemStatusMeta.tone}
                      />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <Metric
                        label="Eficiencia"
                        value={formatPercentage(insight.efficiency / 100)}
                      />
                      <Metric
                        label="Alertas"
                        value={String(insight.alertCount).padStart(2, "0")}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Contexto setorial"
            description="Resumo executivo do setor selecionado com metas, supervisao e gargalo dominante."
          >
            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/8 bg-white/4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    {selectedInsight.sectorName}
                  </p>
                </div>
                <h3 className="mt-3 text-xl font-semibold">
                  {selectedInsight.supervisors.join(" / ")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Supervisao vinculada ao setor. Gargalo atual: {selectedInsight.bottleneckSummary}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile
                  label="Produzido"
                  value={`${formatCompactNumber(selectedInsight.produced)} pcs`}
                  caption={`Meta ${formatCompactNumber(selectedInsight.target)} pcs`}
                  icon={<Activity className="h-4 w-4 text-[color:var(--accent)]" />}
                />
                <MetricTile
                  label="Gap para meta"
                  value={`${formatCompactNumber(selectedInsight.throughputGap)} pcs`}
                  caption="Volume ainda pendente no turno"
                  icon={<GaugeCircle className="h-4 w-4 text-[color:var(--warning)]" />}
                />
                <MetricTile
                  label="Alertas ativos"
                  value={String(selectedInsight.alertCount).padStart(2, "0")}
                  caption={`${selectedSectorAlerts.length} ocorrencias no setor`}
                  icon={<TriangleAlert className="h-4 w-4 text-[color:var(--danger)]" />}
                />
                <MetricTile
                  label="Maquinas em acao"
                  value={`${selectedInsight.machines.length - machinesInAttention}/${selectedInsight.machines.length}`}
                  caption="Ativos operando sem ajuste"
                  icon={<Wrench className="h-4 w-4 text-[color:var(--success)]" />}
                />
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <SectorLineBoard lines={selectedInsight.lines} />
          <SectorOrdersQueue
            orders={selectedInsight.orders}
            currentTime={snapshot.currentTime}
            selectedSector={selectedInsight.key}
            selectedOrderId={selectedOrderId}
          />
        </section>

        <SectorMachineGrid machines={selectedInsight.machines} />
      </div>
    </AppShell>
  );
}

type MetricTileProps = {
  label: string;
  value: string;
  caption: string;
  icon: ReactNode;
};

function MetricTile({ label, value, caption, icon }: MetricTileProps) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[color:var(--panel-strong)] p-4">
      <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
        {icon}
        {label}
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{caption}</p>
    </div>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

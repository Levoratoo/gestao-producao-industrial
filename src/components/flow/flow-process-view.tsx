"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, FileStack, PackageCheck, Route, TimerReset } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProcessOrderDetailPanel } from "@/components/flow/process-order-detail-panel";
import { ProcessStageBoard } from "@/components/flow/process-stage-board";
import { ProcessStageOrdersTable } from "@/components/flow/process-stage-orders-table";
import { ShipmentManifestBoard } from "@/components/flow/shipment-manifest-board";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { OrderProcessFlow, WorkflowStageKey } from "@/domain/production/types";
import { useProductionSimulation } from "@/hooks/use-production-simulation";
import { formatCompactNumber, formatDateTimeShort, formatPercentage } from "@/lib/formatters";
import { buildOrdersHref, buildSectorsHref } from "@/lib/navigation";
import { getWorkflowLaneLabel, getWorkflowStageStatusMeta } from "@/lib/workflow-meta";

const defaultStage: WorkflowStageKey = "qualidade";

export function FlowProcessView() {
  const snapshot = useProductionSimulation();
  const searchParams = useSearchParams();
  const requestedStage = searchParams.get("stage") as WorkflowStageKey | null;
  const requestedOrderId = searchParams.get("orderId");
  const resolvedRequestedStage = snapshot.processStages.find((stage) => stage.key === requestedStage)?.key;
  const initialStage =
    resolvedRequestedStage ??
    snapshot.processStages.find((stage) => stage.activeOrders > 0)?.key ??
    defaultStage;
  const [selectedStage, setSelectedStage] = useState<WorkflowStageKey>(initialStage);
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(requestedOrderId ?? undefined);

  const selectedStageOverview =
    snapshot.processStages.find((stage) => stage.key === selectedStage) ?? snapshot.processStages[0];

  const stageFlows = useMemo(() => {
    const ranked = snapshot.orderFlows
      .map((flow) => ({
        flow,
        stage: flow.stages.find((item) => item.key === selectedStage),
      }))
      .filter((item): item is { flow: OrderProcessFlow; stage: NonNullable<typeof item.stage> } => Boolean(item.stage))
      .filter((item) => item.stage.status !== "concluida" || selectedStage === "embarque")
      .sort((left, right) => {
        const statusRank = { bloqueada: 0, em_andamento: 1, pronta: 2, aguardando: 3, concluida: 4 };
        return statusRank[left.stage.status] - statusRank[right.stage.status];
      });

    return ranked.map((item) => item.flow);
  }, [selectedStage, snapshot.orderFlows]);

  const selectedFlow =
    stageFlows.find((flow) => flow.orderId === selectedOrderId) ??
    stageFlows.find((flow) => flow.orderId === requestedOrderId) ??
    stageFlows[0] ??
    snapshot.orderFlows[0];

  const selectedStatusMeta = getWorkflowStageStatusMeta(selectedStageOverview.status);
  const blockedCount = stageFlows.filter((flow) =>
    flow.stages.find((stage) => stage.key === selectedStage)?.status === "bloqueada",
  ).length;
  const manifests = snapshot.shipmentManifests.filter(
    (manifest) =>
      stageFlows.some((flow) => flow.orderId === manifest.orderId) ||
      ["expedicao", "faturamento", "embarque"].includes(selectedStage),
  );

  return (
    <AppShell
      eyebrow="Fluxo ponta a ponta"
      title="Da engenharia ao caminhão"
      subtitle="Pipeline completo do pedido, do desenho tecnico ao faturamento e embarque, com autoalimentacao do sistema em cada etapa e drill-down operacional por ordem."
      meta={
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            {snapshot.processStages.length} etapas orquestradas
          </div>
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            Atualizado em {formatDateTimeShort(snapshot.currentTime)}
          </div>
        </div>
      }
      actions={<StatusBadge label={selectedStatusMeta.label} tone={selectedStatusMeta.tone} />}
    >
      <div className="space-y-4">
        <SectionCard
          title="Pipeline operacional"
          description="Cada etapa se autoalimenta a partir do snapshot da operacao e expande a leitura para documentos, SLA, backlog e despacho."
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildOrdersHref()}
                className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
              >
                Abrir carteira
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={buildSectorsHref()}
                className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
              >
                Ver setores fabris
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          }
        >
          <ProcessStageBoard
            stages={snapshot.processStages}
            selectedStage={selectedStage}
            onSelect={(stage) => {
              setSelectedStage(stage);
              setSelectedOrderId(undefined);
            }}
          />
        </SectionCard>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.95fr]">
          <SectionCard
            title={`Controle da etapa: ${selectedStageOverview.label}`}
            description="Indicadores taticos da etapa selecionada para leitura de fila, documentos e performance."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Equipe dona"
                value={selectedStageOverview.ownerTeam}
                caption={getWorkflowLaneLabel(selectedStageOverview.lane)}
                icon={<Route className="h-4 w-4 text-[color:var(--accent)]" />}
              />
              <MetricTile
                label="Backlog"
                value={`${formatCompactNumber(selectedStageOverview.backlogUnits)} pcs`}
                caption={`${selectedStageOverview.activeOrders} OPs ativas`}
                icon={<PackageCheck className="h-4 w-4 text-[color:var(--warning)]" />}
              />
              <MetricTile
                label="SLA medio"
                value={`${selectedStageOverview.leadTimeHours.toFixed(1)}h`}
                caption={`Janela alvo ${selectedStageOverview.slaHours}h`}
                icon={<TimerReset className="h-4 w-4 text-[color:var(--info)]" />}
              />
              <MetricTile
                label="Documentos"
                value={String(selectedStageOverview.pendingDocuments).padStart(2, "0")}
                caption={`${blockedCount} OPs bloqueadas`}
                icon={<FileStack className="h-4 w-4 text-[color:var(--danger)]" />}
              />
            </div>
            <div className="mt-4 rounded-[26px] border border-white/8 bg-white/4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    Gargalo dominante
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {selectedStageOverview.bottleneckSummary}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">Eficiencia</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatPercentage(selectedStageOverview.efficiency / 100)}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Fila da etapa"
            description="Ordens prontas, em processamento ou aguardando liberacao na etapa selecionada."
            action={
              <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)]">
                {stageFlows.length} OPs relacionadas
              </div>
            }
          >
            <div className="space-y-3">
              {stageFlows.slice(0, 5).map((flow) => {
                const stage = flow.stages.find((item) => item.key === selectedStage);

                if (!stage) {
                  return null;
                }

                const statusMeta = getWorkflowStageStatusMeta(stage.status);

                return (
                  <button
                    key={flow.orderId}
                    type="button"
                    onClick={() => setSelectedOrderId(flow.orderId)}
                    className={`block w-full rounded-[24px] border p-4 text-left transition-colors ${
                      selectedFlow?.orderId === flow.orderId
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                        : "border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/6"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                          {flow.orderNumber}
                        </p>
                        <h4 className="mt-2 text-base font-medium text-white">{flow.customerName}</h4>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">{flow.productName}</p>
                      </div>
                      <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#efbc68,#f1d79c)]"
                        style={{ width: `${Math.max(stage.progress, 4)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <SectionCard
            title="Drill-down por ordem"
            description="Clique em uma OP para ver documentos, fila, SLA e pendencias da etapa atual."
          >
            <ProcessStageOrdersTable
              stageKey={selectedStage}
              flows={stageFlows}
              selectedFlowId={selectedFlow?.orderId}
              onSelect={setSelectedOrderId}
            />
          </SectionCard>

          {selectedFlow ? (
            <ProcessOrderDetailPanel flow={selectedFlow} stageKey={selectedStage} />
          ) : null}
        </section>

        <ShipmentManifestBoard manifests={manifests.slice(0, 6)} />
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
      <p className="mt-4 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{caption}</p>
    </div>
  );
}


import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { OrderProcessFlow, WorkflowStageKey } from "@/domain/production/types";
import { formatCompactNumber, formatDateTimeShort } from "@/lib/formatters";
import { getWorkflowLaneLabel, getWorkflowStageStatusMeta } from "@/lib/workflow-meta";

type ProcessOrderDetailPanelProps = {
  flow: OrderProcessFlow;
  stageKey: WorkflowStageKey;
};

export function ProcessOrderDetailPanel({
  flow,
  stageKey,
}: ProcessOrderDetailPanelProps) {
  const selectedStage = flow.stages.find((stage) => stage.key === stageKey) ?? flow.stages[0];
  const stageStatusMeta = getWorkflowStageStatusMeta(selectedStage.status);

  return (
    <SectionCard
      title={`Microgerenciamento da ${selectedStage.label}`}
      description="Visao detalhada da OP selecionada com timeline da etapa, documentos e pendencias operacionais."
      action={<StatusBadge label={stageStatusMeta.label} tone={stageStatusMeta.tone} />}
      className="h-full"
    >
      <div className="space-y-5">
        <div className="rounded-[26px] border border-white/8 bg-white/4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                {flow.orderNumber}
              </p>
              <h4 className="mt-2 text-lg font-semibold">{flow.productName}</h4>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                {flow.customerName} • {formatCompactNumber(flow.deliveredQuantity)} de {formatCompactNumber(flow.plannedQuantity)} pcs
              </p>
            </div>
            <div className="space-y-2 text-right text-sm text-[color:var(--muted)]">
              <p>{flow.currentStageLabel}</p>
              <p>{Math.round(flow.overallCompletion)}% do fluxo total</p>
            </div>
          </div>
          <div className="mt-4 h-2.5 rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6a6,#77d7d3)]"
              style={{ width: `${Math.max(flow.overallCompletion, 4)}%` }}
            />
          </div>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-[color:var(--panel-strong)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Time responsavel
              </p>
              <p className="mt-2 text-base font-medium text-white">{selectedStage.ownerTeam}</p>
            </div>
            <div className="text-right text-sm text-[color:var(--muted)]">
              <p>{getWorkflowLaneLabel(selectedStage.lane)}</p>
              <p className="mt-1">Atualizado em {formatDateTimeShort(selectedStage.updatedAt)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">{selectedStage.note}</p>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-white">Timeline do fluxo</p>
          <div className="space-y-3">
            {flow.stages.map((stage) => {
              const statusMeta = getWorkflowStageStatusMeta(stage.status);
              const isSelected = stage.key === stageKey;

              return (
                <div
                  key={stage.key}
                  className={`rounded-[22px] border p-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                        {getWorkflowLaneLabel(stage.lane)}
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">{stage.label}</p>
                    </div>
                    <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#efbc68,#f1d79c)]"
                      style={{ width: `${Math.max(stage.progress, 4)}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[color:var(--muted)]">
                    <p>{Math.round(stage.progress)}% da etapa</p>
                    <p className="text-right">{stage.leadTimeHours.toFixed(1)}h / {stage.slaHours}h</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[26px] border border-white/8 bg-white/4 p-4">
            <p className="text-sm font-medium text-white">Documentos da etapa</p>
            <div className="mt-4 space-y-3">
              {selectedStage.documents.map((document) => {
                const documentMeta = getDocumentTone(document.status);

                return (
                  <div
                    key={document.id}
                    className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{document.label}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted)]">{document.owner}</p>
                      </div>
                      <StatusBadge label={documentMeta.label} tone={documentMeta.tone} />
                    </div>
                    <p className="mt-3 text-xs text-[color:var(--muted)]">
                      {document.reference ?? "Referencia ainda nao emitida"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-white/4 p-4">
            <p className="text-sm font-medium text-white">Pendencias e despacho</p>
            <div className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
              {selectedStage.blockers.length > 0 ? (
                selectedStage.blockers.map((blocker) => (
                  <div
                    key={blocker}
                    className="rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-4 text-[color:var(--danger)]"
                  >
                    {blocker}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[color:var(--success)]/30 bg-[color:var(--success-soft)] p-4 text-[color:var(--success)]">
                  Nenhum bloqueio aberto nesta etapa.
                </div>
              )}

              <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">Faturamento</p>
                <p className="mt-2 text-sm text-white">{flow.invoiceNumber ?? "NF ainda nao emitida"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">Minuta / embarque</p>
                <p className="mt-2 text-sm text-white">{flow.manifestNumber ?? "Minuta ainda nao gerada"}</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  {flow.truckPlate ? `Caminhao ${flow.truckPlate}` : "Aguardando vinculacao de caminhão"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function getDocumentTone(status: string) {
  if (status === "emitido") {
    return { label: "Emitido", tone: "success" as const };
  }

  if (status === "liberado") {
    return { label: "Liberado", tone: "info" as const };
  }

  if (status === "em_revisao") {
    return { label: "Em revisao", tone: "warning" as const };
  }

  return { label: "Pendente", tone: "neutral" as const };
}


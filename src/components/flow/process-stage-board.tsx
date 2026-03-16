"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { ProcessStageOverview, WorkflowStageKey } from "@/domain/production/types";
import { formatCompactNumber, formatPercentage } from "@/lib/formatters";
import { getWorkflowLaneLabel, getWorkflowStageStatusMeta } from "@/lib/workflow-meta";

type ProcessStageBoardProps = {
  stages: ProcessStageOverview[];
  selectedStage: WorkflowStageKey;
  onSelect: (stage: WorkflowStageKey) => void;
};

export function ProcessStageBoard({
  stages,
  selectedStage,
  onSelect,
}: ProcessStageBoardProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {stages.map((stage) => {
        const statusMeta = getWorkflowStageStatusMeta(stage.status);
        const isSelected = stage.key === selectedStage;

        return (
          <button
            key={stage.key}
            type="button"
            onClick={() => onSelect(stage.key)}
            className={`rounded-[26px] border p-5 text-left transition-colors ${
              isSelected
                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                : "border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/6"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {getWorkflowLaneLabel(stage.lane)}
                </p>
                <h3 className="mt-2 text-lg font-medium">{stage.label}</h3>
              </div>
              <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric label="OPs ativas" value={String(stage.activeOrders).padStart(2, "0")} />
              <Metric label="Pendencias" value={String(stage.pendingDocuments).padStart(2, "0")} />
              <Metric label="Backlog" value={formatCompactNumber(stage.backlogUnits)} />
              <Metric label="Eficiencia" value={formatPercentage(stage.efficiency / 100)} />
            </div>
          </button>
        );
      })}
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
      <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}


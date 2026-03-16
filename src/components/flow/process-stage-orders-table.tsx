"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { OrderProcessFlow, WorkflowStageKey } from "@/domain/production/types";
import { formatCompactNumber, formatDateTimeShort } from "@/lib/formatters";
import { getWorkflowStageStatusMeta } from "@/lib/workflow-meta";

type ProcessStageOrdersTableProps = {
  stageKey: WorkflowStageKey;
  flows: OrderProcessFlow[];
  selectedFlowId?: string;
  onSelect: (orderId: string) => void;
};

export function ProcessStageOrdersTable({
  stageKey,
  flows,
  selectedFlowId,
  onSelect,
}: ProcessStageOrdersTableProps) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-3">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
            <th className="px-4 pb-1 font-medium">OP</th>
            <th className="px-4 pb-1 font-medium">Cliente</th>
            <th className="px-4 pb-1 font-medium">Etapa</th>
            <th className="px-4 pb-1 font-medium">Docs</th>
            <th className="px-4 pb-1 font-medium">Fila</th>
            <th className="px-4 pb-1 font-medium">SLA</th>
            <th className="px-4 pb-1 font-medium">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {flows.map((flow) => {
            const stage = flow.stages.find((item) => item.key === stageKey);

            if (!stage) {
              return null;
            }

            const statusMeta = getWorkflowStageStatusMeta(stage.status);
            const selected = flow.orderId === selectedFlowId;
            const pendingDocs = stage.documents.filter(
              (document) => document.status === "pendente" || document.status === "em_revisao",
            ).length;

            return (
              <tr
                key={flow.orderId}
                className={`rounded-[24px] text-sm transition-colors ${
                  selected ? "bg-[color:var(--accent-soft)]" : "bg-white/4"
                }`}
              >
                <td className="rounded-l-[24px] border-y border-l border-white/8 px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onSelect(flow.orderId)}
                    className="text-left"
                  >
                    <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      {flow.orderNumber}
                    </p>
                    <p className="mt-2 font-medium text-white">{flow.productName}</p>
                  </button>
                </td>
                <td className="border-y border-white/8 px-4 py-4 text-[color:var(--muted)]">
                  {flow.customerName}
                </td>
                <td className="border-y border-white/8 px-4 py-4">
                  <div className="space-y-2">
                    <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                    <p className="text-xs text-[color:var(--muted)]">{Math.round(stage.progress)}% da etapa</p>
                  </div>
                </td>
                <td className="border-y border-white/8 px-4 py-4 text-[color:var(--muted)]">
                  {pendingDocs} pend.
                </td>
                <td className="border-y border-white/8 px-4 py-4 text-[color:var(--muted)]">
                  {formatCompactNumber(stage.queueUnits)} pcs
                </td>
                <td className="border-y border-white/8 px-4 py-4 text-[color:var(--muted)]">
                  {stage.leadTimeHours.toFixed(1)}h / {stage.slaHours}h
                </td>
                <td className="rounded-r-[24px] border-y border-r border-white/8 px-4 py-4 text-[color:var(--muted)]">
                  {formatDateTimeShort(stage.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


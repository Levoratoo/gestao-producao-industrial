import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProcessStageOverview } from "@/domain/production/types";
import { buildFlowHref } from "@/lib/navigation";
import { getWorkflowStageStatusMeta } from "@/lib/workflow-meta";

type ProcessLifecycleSummaryProps = {
  stages: ProcessStageOverview[];
};

export function ProcessLifecycleSummary({ stages }: ProcessLifecycleSummaryProps) {
  return (
    <SectionCard
      title="Fluxo ponta a ponta"
      description="Leitura executiva do ciclo completo: engenharia, producao, qualidade, expedicao, faturamento e embarque."
      action={
        <Link
          href={buildFlowHref()}
          className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
        >
          Abrir fluxo detalhado
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {stages.map((stage) => {
          const statusMeta = getWorkflowStageStatusMeta(stage.status);

          return (
            <Link
              key={stage.key}
              href={buildFlowHref({ stage: stage.key })}
              className="rounded-[24px] border border-white/8 bg-white/4 p-4 transition-colors hover:border-[color:var(--accent)] hover:bg-white/6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    {stage.shortLabel}
                  </p>
                  <h4 className="mt-2 text-base font-medium text-white">{stage.label}</h4>
                </div>
                <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[color:var(--muted)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em]">OPs</p>
                  <p className="mt-2 text-white">{stage.activeOrders}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em]">Docs</p>
                  <p className="mt-2 text-white">{stage.pendingDocuments}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

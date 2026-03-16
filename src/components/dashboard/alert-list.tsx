import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProductionAlert } from "@/domain/production/types";
import { formatDateTimeShort } from "@/lib/formatters";
import { buildAlertTargetHref } from "@/lib/navigation";
import { getAlertSeverityMeta } from "@/lib/status-meta";

type AlertListProps = {
  alerts: ProductionAlert[];
};

export function AlertList({ alerts }: AlertListProps) {
  return (
    <SectionCard
      title="Alertas ativos"
      description="Ocorrencias que merecem intervencao ou acompanhamento da lideranca do turno."
      action={
        <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)]">
          {alerts.length} ocorrencias
        </div>
      }
    >
      <div className="space-y-3">
        {alerts.map((alert) => {
          const severityMeta = getAlertSeverityMeta(alert.severity);

          return (
            <Link
              key={alert.id}
              href={buildAlertTargetHref(alert)}
              className="block rounded-[24px] border border-white/8 bg-white/4 p-4 transition-colors hover:border-[color:var(--accent)] hover:bg-white/6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={severityMeta.label}
                      tone={severityMeta.tone}
                    />
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      {alert.sector}
                    </p>
                  </div>
                  <h4 className="mt-3 text-base font-medium">{alert.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {alert.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-3 text-sm text-[color:var(--muted)]">
                  {formatDateTimeShort(alert.timestamp)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

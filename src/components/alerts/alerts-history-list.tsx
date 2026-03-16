"use client";

import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProductionAlert } from "@/domain/production/types";
import { buildAlertTargetHref } from "@/lib/navigation";
import { formatDateTimeShort } from "@/lib/formatters";
import {
  getAlertSeverityMeta,
  getAlertSourceMeta,
  getAlertTypeLabel,
  getSectorLabel,
} from "@/lib/status-meta";
import { ArrowRight } from "lucide-react";

type AlertsHistoryListProps = {
  alerts: ProductionAlert[];
  selectedAlertId?: string | null;
};

export function AlertsHistoryList({
  alerts,
  selectedAlertId,
}: AlertsHistoryListProps) {
  return (
    <SectionCard
      title="Historico operacional"
      description="Rastreabilidade dos alertas confirmados, arquivados ou resolvidos durante o turno."
    >
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-[color:var(--muted)]">
            Nenhum alerta historico para os filtros atuais.
          </div>
        ) : (
          alerts.map((alert) => {
            const severityMeta = getAlertSeverityMeta(alert.severity);
            const sourceMeta = getAlertSourceMeta(alert.source);
            const isSelected = alert.id === selectedAlertId;

            return (
              <article
                key={alert.id}
                className={`rounded-[24px] border p-4 ${
                  isSelected
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                    : "border-white/8 bg-white/4"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={severityMeta.label} tone={severityMeta.tone} />
                      <StatusBadge label={sourceMeta.label} tone={sourceMeta.tone} />
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                        {getAlertTypeLabel(alert.type)}
                      </p>
                    </div>
                    <h3 className="mt-3 text-base font-medium">{alert.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {alert.description}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--muted)]">
                    {formatDateTimeShort(alert.resolvedAt ?? alert.acknowledgedAt ?? alert.timestamp)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoMetric
                    label="Setor"
                    value={alert.sector === "fabrica" ? "Fabrica" : getSectorLabel(alert.sector)}
                  />
                  <InfoMetric label="OP" value={alert.orderNumber ?? "Sem OP direta"} />
                  <InfoMetric
                    label="Confirmado por"
                    value={alert.acknowledgedBy ?? "Resolucao automatica"}
                  />
                  <InfoMetric
                    label="Resolvido em"
                    value={formatDateTimeShort(alert.resolvedAt ?? alert.acknowledgedAt ?? alert.timestamp)}
                  />
                </div>

                <div className="mt-4">
                  <Link
                    href={buildAlertTargetHref(alert)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
                  >
                    Abrir contexto
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

function InfoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

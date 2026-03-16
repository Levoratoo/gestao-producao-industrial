"use client";

import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProductionAlert } from "@/domain/production/types";
import { buildAlertTargetHref, buildSectorsHref } from "@/lib/navigation";
import { formatDateTimeShort } from "@/lib/formatters";
import {
  getAlertSeverityMeta,
  getAlertSourceMeta,
  getAlertTypeLabel,
  getSectorLabel,
} from "@/lib/status-meta";
import { ArrowRight, CheckCheck } from "lucide-react";

type AlertsActiveListProps = {
  alerts: ProductionAlert[];
  selectedAlertId?: string | null;
  onAcknowledge: (alertId: string) => void;
};

export function AlertsActiveList({
  alerts,
  selectedAlertId,
  onAcknowledge,
}: AlertsActiveListProps) {
  return (
    <SectionCard
      title="Alertas ativos"
      description="Ocorrencias em aberto para triagem, encaminhamento e confirmacao de leitura."
    >
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-[color:var(--muted)]">
            Nenhum alerta ativo para os filtros selecionados.
          </div>
        ) : (
          alerts.map((alert) => {
            const severityMeta = getAlertSeverityMeta(alert.severity);
            const sourceMeta = getAlertSourceMeta(alert.source);
            const isSelected = alert.id === selectedAlertId;

            return (
              <article
                key={alert.id}
                className={`rounded-[24px] border p-5 ${
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
                    <h3 className="mt-3 text-lg font-medium">{alert.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {alert.description}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--muted)]">
                    {formatDateTimeShort(alert.timestamp)}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted)]">
                  <span>Setor: {alert.sector === "fabrica" ? "Fabrica" : getSectorLabel(alert.sector)}</span>
                  {alert.orderNumber ? <span className="text-white/20">/</span> : null}
                  {alert.orderNumber ? <span>OP: {alert.orderNumber}</span> : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onAcknowledge(alert.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--success)] bg-[color:var(--success-soft)] px-4 py-2 text-sm text-[color:var(--success)] transition-colors hover:bg-[color:var(--success)]/12"
                  >
                    Confirmar leitura
                    <CheckCheck className="h-4 w-4" />
                  </button>
                  <Link
                    href={buildAlertTargetHref(alert)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
                  >
                    {alert.orderNumber ? "Abrir OP" : "Abrir setor"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={buildSectorsHref({
                      sector: alert.sector === "fabrica" ? "costura" : alert.sector,
                    })}
                    className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
                  >
                    Ir para setor
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

import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type {
  ProductionAlert,
  ProductionManualEntry,
  ProductionOrder,
} from "@/domain/production/types";
import { formatDateTimeShort } from "@/lib/formatters";
import {
  getAlertSeverityMeta,
  getManualActionMeta,
  getManualQualityCategoryLabel,
  getSectorLabel,
} from "@/lib/status-meta";

type ManualActivityFeedProps = {
  manualEntries: ProductionManualEntry[];
  orders: ProductionOrder[];
  alerts: ProductionAlert[];
};

export function ManualActivityFeed({
  manualEntries,
  orders,
  alerts,
}: ManualActivityFeedProps) {
  const openStops = orders.filter((order) => order.status === "parada");
  const criticalAlerts = alerts.filter((alert) => alert.severity === "high");

  return (
    <div className="space-y-4">
      <SectionCard
        title="Historico de apontamentos"
        description="Ultimos lancamentos manuais aplicados diretamente na operacao simulada."
      >
        <div className="space-y-3">
          {manualEntries.slice(0, 8).map((entry) => {
            const actionMeta = getManualActionMeta(entry.action);

            return (
              <article
                key={entry.id}
                className="rounded-[24px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={actionMeta.label} tone={actionMeta.tone} />
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      {entry.orderNumber}
                    </p>
                  </div>
                  <span className="text-xs text-[color:var(--muted)]">
                    {formatDateTimeShort(entry.timestamp)}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-white">
                  {entry.operatorName} em {getSectorLabel(entry.sector)}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {buildManualEntryDescription(entry)}
                </p>
              </article>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Ocorrencias abertas"
        description="Paradas ativas e alertas criticos que ainda exigem acao no turno."
      >
        <div className="space-y-3">
          {openStops.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/3 px-5 py-8 text-center text-sm text-[color:var(--muted)]">
              Nenhuma parada aberta no momento.
            </div>
          ) : (
            openStops.map((order) => (
              <div
                key={order.id}
                className="rounded-[24px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    {order.number}
                  </p>
                  <StatusBadge label="Parada" tone="danger" />
                </div>
                <p className="mt-3 text-sm font-medium text-white">
                  {order.productName}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Setor atual: {getSectorLabel(order.currentSector)}
                </p>
              </div>
            ))
          )}

          {criticalAlerts.slice(0, 3).map((alert) => {
            const severityMeta = getAlertSeverityMeta(alert.severity);

            return (
              <div
                key={alert.id}
                className="rounded-[24px] border border-white/8 bg-[color:var(--panel-strong)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={severityMeta.label}
                    tone={severityMeta.tone}
                  />
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    {alert.orderNumber ?? getSectorLabel(alert.sector === "fabrica" ? "expedicao" : alert.sector)}
                  </p>
                </div>
                <p className="mt-3 text-sm font-medium text-white">{alert.title}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {alert.description}
                </p>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function buildManualEntryDescription(entry: ProductionManualEntry) {
  if (entry.action === "apontar_producao") {
    return `${entry.quantity ?? 0} pecas registradas para ${entry.productName}. ${entry.note ?? ""}`.trim();
  }

  if (entry.action === "registrar_parada") {
    return `Parada de ${entry.durationMinutes ?? 0} min. Motivo: ${entry.reason ?? "Nao informado"}.`;
  }

  if (entry.action === "registrar_defeito") {
    const categoryLabel = entry.qualityCategory
      ? getManualQualityCategoryLabel(entry.qualityCategory)
      : "Qualidade";
    return `${entry.quantity ?? 0} pecas em ${categoryLabel.toLowerCase()}. Motivo: ${entry.reason ?? "Nao informado"}.`;
  }

  if (entry.action === "finalizar_etapa") {
    return entry.note ?? "Etapa concluida manualmente e liberada para o proximo setor.";
  }

  return entry.note ?? "OP iniciada manualmente no posto selecionado.";
}

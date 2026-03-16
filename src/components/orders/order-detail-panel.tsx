import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { sectorSequence } from "@/domain/production/mock-data";
import type {
  Product,
  ProductionAlert,
  ProductionOrder,
} from "@/domain/production/types";
import {
  formatCompactNumber,
  formatDateShort,
  formatPercentage,
} from "@/lib/formatters";
import { buildAlertsHref, buildSectorsHref } from "@/lib/navigation";
import {
  getOrderCompletionPercent,
  getOrderDueMeta,
  getOrderRecommendedAction,
} from "@/lib/order-helpers";
import {
  getAlertSeverityMeta,
  getAlertTypeLabel,
  getOrderStatusMeta,
  getPriorityMeta,
  getSectorLabel,
} from "@/lib/status-meta";

type OrderDetailPanelProps = {
  selectedOrder: ProductionOrder | null;
  currentTime: string;
  relatedAlerts: ProductionAlert[];
  product: Product | undefined;
};

export function OrderDetailPanel({
  selectedOrder,
  currentTime,
  relatedAlerts,
  product,
}: OrderDetailPanelProps) {
  if (!selectedOrder) {
    return (
      <SectionCard
        title="Detalhe da OP"
        description="Selecione uma ordem para visualizar progresso, riscos e acao recomendada."
      >
        <div className="rounded-[28px] border border-dashed border-white/10 bg-white/3 px-6 py-12 text-center">
          <p className="text-base font-medium">Nenhuma ordem selecionada.</p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Escolha uma OP na tabela para acompanhar o fluxo setorial.
          </p>
        </div>
      </SectionCard>
    );
  }

  const statusMeta = getOrderStatusMeta(selectedOrder.status);
  const priorityMeta = getPriorityMeta(selectedOrder.priority);
  const dueMeta = getOrderDueMeta(selectedOrder, currentTime);
  const completion = getOrderCompletionPercent(selectedOrder);
  const remainingQuantity =
    selectedOrder.plannedQuantity - selectedOrder.producedQuantity;
  const currentSectorIndex = sectorSequence.indexOf(selectedOrder.currentSector);

  return (
    <SectionCard
      title="Detalhe da OP"
      description="Visao de acompanhamento operacional da ordem selecionada."
      action={<StatusBadge label={dueMeta.label} tone={dueMeta.tone} />}
    >
      <div className="space-y-5">
        <div className="rounded-[28px] border border-white/8 bg-white/4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {selectedOrder.number}
                </p>
                <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                <StatusBadge
                  label={priorityMeta.label}
                  tone={priorityMeta.tone}
                />
              </div>
              <h3 className="mt-3 text-xl font-semibold">
                {selectedOrder.productName}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {selectedOrder.line} - setor atual em {getSectorLabel(selectedOrder.currentSector)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Conclusao
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatPercentage(completion / 100)}
              </p>
            </div>
          </div>

          <div className="mt-5 h-2.5 rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6a6,#77d7d3)]"
              style={{ width: `${Math.max(completion, 4)}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MetricBox
            label="Planejado"
            value={`${formatCompactNumber(selectedOrder.plannedQuantity)} pecas`}
          />
          <MetricBox
            label="Produzido"
            value={`${formatCompactNumber(selectedOrder.producedQuantity)} pecas`}
          />
          <MetricBox
            label="Saldo restante"
            value={`${formatCompactNumber(remainingQuantity)} pecas`}
          />
          <MetricBox
            label="Defeitos"
            value={formatPercentage(selectedOrder.defectRate / 100)}
          />
          <MetricBox
            label="Prazo"
            value={formatDateShort(selectedOrder.dueDate)}
          />
          <MetricBox
            label="Ultima atualizacao"
            value={formatDateShort(selectedOrder.lastUpdate)}
          />
        </div>

        <div className="rounded-[28px] border border-white/8 bg-white/4 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Fluxo produtivo
          </p>
          <div className="mt-4 grid gap-3">
            {sectorSequence.map((sectorKey, index) => {
              const isCompleted =
                selectedOrder.status === "concluida" || index < currentSectorIndex;
              const isCurrent =
                selectedOrder.status !== "concluida" &&
                index === currentSectorIndex;

              return (
                <div
                  key={sectorKey}
                  className={`rounded-2xl border px-4 py-3 ${
                    isCurrent
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : isCompleted
                        ? "border-[color:var(--success)]/20 bg-[color:var(--success-soft)]"
                        : "border-white/8 bg-[color:var(--panel-strong)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {getSectorLabel(sectorKey)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                        {isCurrent
                          ? "Etapa atual"
                          : isCompleted
                            ? "Concluida"
                            : "Aguardando"}
                      </p>
                    </div>
                    <span
                      className={`h-3 w-3 rounded-full ${
                        isCurrent
                          ? "bg-[color:var(--accent)]"
                          : isCompleted
                            ? "bg-[color:var(--success)]"
                            : "bg-white/12"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-white/4 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Contexto do produto
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricBox
              label="SKU"
              value={product?.sku ?? "Nao definido"}
            />
            <MetricBox
              label="Categoria"
              value={product?.category ?? "Nao definida"}
            />
            <MetricBox
              label="SMV"
              value={
                product
                  ? `${product.standardMinuteValue.toFixed(1)} min`
                  : "Nao definido"
              }
            />
            <MetricBox
              label="Capacidade media"
              value={
                product
                  ? `${formatCompactNumber(product.averageUnitsPerHour)} pecas/h`
                  : "Nao definida"
              }
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-white/4 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Acao recomendada
          </p>
          <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
            {getOrderRecommendedAction(selectedOrder)}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={buildSectorsHref({
                sector: selectedOrder.currentSector,
                orderId: selectedOrder.id,
              })}
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
            >
              Abrir setor atual
            </Link>
            <Link
              href={buildAlertsHref({
                sector: selectedOrder.currentSector,
                orderNumber: selectedOrder.number,
              })}
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
            >
              Ver alertas da OP
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-white/4 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Alertas relacionados
            </p>
            <span className="rounded-full border border-white/8 bg-[color:var(--panel-strong)] px-3 py-1 text-xs text-[color:var(--muted)]">
              {relatedAlerts.length} ocorrencias
            </span>
          </div>

          {relatedAlerts.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--muted)]">
              Nenhum alerta diretamente associado a esta ordem no momento.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {relatedAlerts.map((alert) => {
                const severityMeta = getAlertSeverityMeta(alert.severity);

                return (
                  <div
                    key={alert.id}
                    className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={severityMeta.label}
                        tone={severityMeta.tone}
                      />
                      <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                        {getAlertTypeLabel(alert.type)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-white">
                      {alert.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {alert.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

type MetricBoxProps = {
  label: string;
  value: string;
};

function MetricBox({ label, value }: MetricBoxProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

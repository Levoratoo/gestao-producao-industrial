"use client";

import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProductionOrder, SectorKey } from "@/domain/production/types";
import { buildOrdersHref } from "@/lib/navigation";
import {
  formatCompactNumber,
  formatDateShort,
  formatPercentage,
} from "@/lib/formatters";
import { getOrderCompletionPercent, getOrderDueMeta } from "@/lib/order-helpers";
import {
  getOrderStatusMeta,
  getPriorityMeta,
  getSectorLabel,
} from "@/lib/status-meta";
import { ArrowRight } from "lucide-react";

type SectorOrdersQueueProps = {
  orders: ProductionOrder[];
  currentTime: string;
  selectedSector: SectorKey;
  selectedOrderId?: string | null;
};

export function SectorOrdersQueue({
  orders,
  currentTime,
  selectedSector,
  selectedOrderId,
}: SectorOrdersQueueProps) {
  return (
    <SectionCard
      title="Fila de ordens do setor"
      description="OPs alocadas na etapa selecionada com atalho para a carteira completa."
      action={
        <Link
          href={buildOrdersHref({ sector: selectedSector })}
          className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
        >
          Ver carteira do setor
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-[color:var(--muted)]">
            Nenhuma OP alocada neste setor no momento.
          </div>
        ) : (
          orders.map((order) => {
            const statusMeta = getOrderStatusMeta(order.status);
            const priorityMeta = getPriorityMeta(order.priority);
            const dueMeta = getOrderDueMeta(order, currentTime);
            const completion = getOrderCompletionPercent(order);
            const isSelected = order.id === selectedOrderId;

            return (
              <Link
                key={order.id}
                href={buildOrdersHref({
                  orderId: order.id,
                  sector: order.currentSector,
                })}
                className={`block rounded-[24px] border p-4 transition-colors ${
                  isSelected
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                    : "border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/6"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                        {order.number}
                      </p>
                      <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                      <StatusBadge label={priorityMeta.label} tone={priorityMeta.tone} />
                    </div>
                    <h4 className="mt-3 text-base font-medium">{order.productName}</h4>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {order.line} - {getSectorLabel(order.currentSector)}
                    </p>
                  </div>
                  <StatusBadge label={dueMeta.label} tone={dueMeta.tone} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Produzido" value={`${formatCompactNumber(order.producedQuantity)} pcs`} />
                  <Metric label="Prazo" value={formatDateShort(order.dueDate)} />
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    <span>Conclusao</span>
                    <span>{formatPercentage(completion / 100)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6a6,#77d7d3)]"
                      style={{ width: `${Math.max(completion, 4)}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

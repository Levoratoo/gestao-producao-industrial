"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProductionOrder } from "@/domain/production/types";
import {
  formatCompactNumber,
  formatDateShort,
  formatPercentage,
} from "@/lib/formatters";
import {
  getOrderCompletionPercent,
  getOrderDueMeta,
} from "@/lib/order-helpers";
import {
  getOrderStatusMeta,
  getPriorityMeta,
  getSectorLabel,
} from "@/lib/status-meta";
import { buildSectorsHref } from "@/lib/navigation";
import { ArrowRight } from "lucide-react";

type OrdersTableProps = {
  orders: ProductionOrder[];
  currentTime: string;
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
};

export function OrdersTable({
  orders,
  currentTime,
  selectedOrderId,
  onSelectOrder,
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/10 bg-white/3 px-6 py-12 text-center">
        <p className="text-base font-medium">Nenhuma OP encontrada.</p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Ajuste os filtros para ampliar a carteira exibida.
        </p>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-3">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
            <th className="px-4 pb-1 font-medium">OP</th>
            <th className="px-4 pb-1 font-medium">Produto</th>
            <th className="px-4 pb-1 font-medium">Prioridade</th>
            <th className="px-4 pb-1 font-medium">Setor</th>
            <th className="px-4 pb-1 font-medium">Prazo</th>
            <th className="px-4 pb-1 font-medium">Status</th>
            <th className="px-4 pb-1 font-medium">Producao</th>
            <th className="px-4 pb-1 font-medium">Conclusao</th>
            <th className="px-4 pb-1 font-medium">Acao</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const statusMeta = getOrderStatusMeta(order.status);
            const priorityMeta = getPriorityMeta(order.priority);
            const dueMeta = getOrderDueMeta(order, currentTime);
            const completion = getOrderCompletionPercent(order);
            const isSelected = order.id === selectedOrderId;

            return (
              <tr
                key={order.id}
                className={`text-sm ${
                  isSelected ? "text-white" : "text-[color:var(--muted)]"
                }`}
              >
                <td
                  className={`rounded-l-[24px] border-y border-l px-4 py-4 font-mono text-[12px] uppercase tracking-[0.16em] ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  {order.number}
                </td>
                <td
                  className={`border-y px-4 py-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <p className="font-medium text-white">{order.productName}</p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {order.line}
                  </p>
                </td>
                <td
                  className={`border-y px-4 py-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <StatusBadge
                    label={priorityMeta.label}
                    tone={priorityMeta.tone}
                  />
                </td>
                <td
                  className={`border-y px-4 py-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <Link
                    href={buildSectorsHref({
                      sector: order.currentSector,
                      orderId: order.id,
                    })}
                    className="transition-colors hover:text-white"
                  >
                    {getSectorLabel(order.currentSector)}
                  </Link>
                </td>
                <td
                  className={`border-y px-4 py-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <div className="space-y-2">
                    <p>{formatDateShort(order.dueDate)}</p>
                    <StatusBadge label={dueMeta.label} tone={dueMeta.tone} />
                  </div>
                </td>
                <td
                  className={`border-y px-4 py-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <StatusBadge
                    label={statusMeta.label}
                    tone={statusMeta.tone}
                  />
                </td>
                <td
                  className={`border-y px-4 py-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <p className="font-medium text-white">
                    {formatCompactNumber(order.producedQuantity)}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    de {formatCompactNumber(order.plannedQuantity)} pecas
                  </p>
                </td>
                <td
                  className={`border-y px-4 py-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <div className="w-[150px]">
                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      {formatPercentage(completion / 100)}
                    </p>
                    <div className="h-2 rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6a6,#77d7d3)]"
                        style={{ width: `${Math.max(completion, 4)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td
                  className={`rounded-r-[24px] border-y border-r px-4 py-4 ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectOrder(order.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                      isSelected
                        ? "border-[color:var(--accent)] bg-white/10 text-white"
                        : "border-white/8 bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-white"
                    }`}
                  >
                    {isSelected ? "Selecionada" : "Abrir"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProductionOrder } from "@/domain/production/types";
import {
  formatCompactNumber,
  formatDateShort,
  formatPercentage,
} from "@/lib/formatters";
import { buildOrdersHref, buildSectorsHref } from "@/lib/navigation";
import { getOrderStatusMeta, getSectorLabel } from "@/lib/status-meta";

type OrdersOverviewTableProps = {
  orders: ProductionOrder[];
};

export function OrdersOverviewTable({
  orders,
}: OrdersOverviewTableProps) {
  return (
    <SectionCard
      title="Ordens de producao"
      description="Estrutura inicial do modulo de OPs ja conectada aos mesmos mocks e ao motor de simulacao."
    >
      <div className="scrollbar-thin overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-3">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              <th className="px-4 pb-1 font-medium">OP</th>
              <th className="px-4 pb-1 font-medium">Produto</th>
              <th className="px-4 pb-1 font-medium">Planejado</th>
              <th className="px-4 pb-1 font-medium">Produzido</th>
              <th className="px-4 pb-1 font-medium">Setor</th>
              <th className="px-4 pb-1 font-medium">Prazo</th>
              <th className="px-4 pb-1 font-medium">Status</th>
              <th className="px-4 pb-1 font-medium">Conclusao</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const statusMeta = getOrderStatusMeta(order.status);
              const completion = (order.producedQuantity / order.plannedQuantity) * 100;

              return (
                <tr
                  key={order.id}
                  className="rounded-[24px] bg-white/4 text-sm"
                >
                  <td className="rounded-l-[24px] border-y border-l border-white/8 px-4 py-4 font-mono text-[12px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    {order.number}
                  </td>
                  <td className="border-y border-white/8 px-4 py-4">
                    <div>
                      <p className="font-medium text-white">{order.productName}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">
                        {order.line}
                      </p>
                    </div>
                  </td>
                  <td className="border-y border-white/8 px-4 py-4 text-[color:var(--muted)]">
                    {formatCompactNumber(order.plannedQuantity)}
                  </td>
                  <td className="border-y border-white/8 px-4 py-4 text-[color:var(--muted)]">
                    {formatCompactNumber(order.producedQuantity)}
                  </td>
                  <td className="border-y border-white/8 px-4 py-4 text-[color:var(--muted)]">
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
                  <td className="border-y border-white/8 px-4 py-4 text-[color:var(--muted)]">
                    {formatDateShort(order.dueDate)}
                  </td>
                  <td className="border-y border-white/8 px-4 py-4">
                    <StatusBadge
                      label={statusMeta.label}
                      tone={statusMeta.tone}
                    />
                  </td>
                  <td className="rounded-r-[24px] border-y border-r border-white/8 px-4 py-4">
                    <Link
                      href={buildOrdersHref({
                        orderId: order.id,
                        sector: order.currentSector,
                      })}
                      className="block w-[140px]"
                    >
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                        {formatPercentage(completion / 100)}
                      </p>
                      <div className="h-2 rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6a6,#77d7d3)]"
                          style={{ width: `${Math.max(completion, 4)}%` }}
                        />
                      </div>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

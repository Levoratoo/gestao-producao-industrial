import type { ProductionOrder } from "@/domain/production/types";
import { formatCompactNumber, formatPercentage } from "@/lib/formatters";
import { getOrderCompletion } from "@/lib/order-helpers";
import { CircleDashed, ClipboardList, OctagonAlert, Target } from "lucide-react";

type OrdersKpiStripProps = {
  orders: ProductionOrder[];
};

export function OrdersKpiStrip({ orders }: OrdersKpiStripProps) {
  const openOrders = orders.filter((order) => order.status !== "concluida");
  const delayedOrders = orders.filter(
    (order) => order.status === "atrasada" || order.status === "parada",
  );
  const highPriorityOrders = openOrders.filter(
    (order) => order.priority === "alta",
  );
  const plannedOpenVolume = openOrders.reduce(
    (total, order) => total + order.plannedQuantity,
    0,
  );
  const averageCompletion =
    openOrders.length > 0
      ? openOrders.reduce(
          (total, order) => total + getOrderCompletion(order),
          0,
        ) / openOrders.length
      : 0;

  const items = [
    {
      label: "Carteira ativa",
      value: String(openOrders.length).padStart(2, "0"),
      caption: `${highPriorityOrders.length} OPs de alta prioridade`,
      icon: ClipboardList,
      tone: "info",
    },
    {
      label: "Ordens em risco",
      value: String(delayedOrders.length).padStart(2, "0"),
      caption: "Atrasadas ou paradas no turno",
      icon: OctagonAlert,
      tone: delayedOrders.length > 0 ? "warning" : "success",
    },
    {
      label: "Carga planejada aberta",
      value: `${formatCompactNumber(plannedOpenVolume)}`,
      caption: "Pecas ainda circulando pela fabrica",
      icon: Target,
      tone: "info",
    },
    {
      label: "Conclusao media",
      value: formatPercentage(averageCompletion),
      caption: "Avanco medio das OPs ativas",
      icon: CircleDashed,
      tone: "success",
    },
  ] as const;

  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <article
            key={item.label}
            className="metric-shadow panel-sheen glass-blur fade-up rounded-[28px] border border-[color:var(--line)] bg-[color:var(--panel)] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[color:var(--muted)]">{item.label}</p>
                <p className="mt-4 text-[2rem] font-semibold leading-none tracking-[0.01em]">
                  {item.value}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                  item.tone === "warning"
                    ? "border-[color:var(--warning)]/20 bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
                    : item.tone === "success"
                      ? "border-[color:var(--success)]/20 bg-[color:var(--success-soft)] text-[color:var(--success)]"
                      : "border-[color:var(--info)]/20 bg-[color:var(--info-soft)] text-[color:var(--info)]"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
              {item.caption}
            </p>
          </article>
        );
      })}
    </section>
  );
}

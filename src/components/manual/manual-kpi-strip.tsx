import type { ProductionManualEntry, ProductionOrder } from "@/domain/production/types";
import { formatCompactNumber } from "@/lib/formatters";
import {
  ClipboardPenLine,
  OctagonPause,
  ShieldAlert,
  UserRound,
} from "lucide-react";

type ManualKpiStripProps = {
  manualEntries: ProductionManualEntry[];
  orders: ProductionOrder[];
};

export function ManualKpiStrip({
  manualEntries,
  orders,
}: ManualKpiStripProps) {
  const openStops = orders.filter((order) => order.status === "parada").length;
  const qualityVolume = manualEntries
    .filter((entry) => entry.action === "registrar_defeito")
    .reduce((total, entry) => total + (entry.quantity ?? 0), 0);
  const lastOperator = manualEntries[0]?.operatorName ?? "Sem lancamentos";

  const items = [
    {
      label: "Apontamentos do turno",
      value: String(manualEntries.length).padStart(2, "0"),
      caption: "Eventos manuais registrados na simulacao",
      icon: ClipboardPenLine,
      tone: "info",
    },
    {
      label: "Paradas abertas",
      value: String(openStops).padStart(2, "0"),
      caption: "OPs que exigem retomada manual",
      icon: OctagonPause,
      tone: openStops > 0 ? "warning" : "success",
    },
    {
      label: "Defeitos e retrabalho",
      value: formatCompactNumber(qualityVolume),
      caption: "Pecas registradas no modulo manual",
      icon: ShieldAlert,
      tone: qualityVolume > 0 ? "warning" : "success",
    },
    {
      label: "Ultimo operador",
      value: lastOperator,
      caption: "Responsavel pelo ultimo apontamento",
      icon: UserRound,
      tone: "info",
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
              <div className="min-w-0">
                <p className="text-sm text-[color:var(--muted)]">{item.label}</p>
                <p className="mt-4 truncate text-[1.8rem] font-semibold leading-none tracking-[0.01em] sm:text-[2rem]">
                  {item.value}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
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

"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ManualActionCenter } from "@/components/manual/manual-action-center";
import { ManualActivityFeed } from "@/components/manual/manual-activity-feed";
import { ManualKpiStrip } from "@/components/manual/manual-kpi-strip";
import { StatusBadge } from "@/components/shared/status-badge";
import { useProductionSimulation } from "@/hooks/use-production-simulation";
import { formatDateTimeShort } from "@/lib/formatters";

export function ManualEntriesView() {
  const snapshot = useProductionSimulation();
  const hasOpenStops = snapshot.orders.some((order) => order.status === "parada");

  return (
    <AppShell
      eyebrow="Apontamento manual"
      title="Lancamentos operacionais"
      subtitle="Modulo de apontamento conectado ao mesmo estado da simulacao para registrar inicio de OP, producao, paradas, defeitos e finalizacao de etapa com impacto imediato na operacao demonstrativa."
      meta={
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            {snapshot.manualEntries.length} lancamentos no turno
          </div>
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            Atualizado em {formatDateTimeShort(snapshot.currentTime)}
          </div>
        </div>
      }
      actions={
        <StatusBadge
          label={hasOpenStops ? "Intervencoes pendentes" : "Fluxo assistido"}
          tone={hasOpenStops ? "warning" : "success"}
        />
      }
    >
      <div className="space-y-4">
        <ManualKpiStrip
          manualEntries={snapshot.manualEntries}
          orders={snapshot.orders}
        />

        <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <ManualActionCenter />
          <ManualActivityFeed
            manualEntries={snapshot.manualEntries}
            orders={snapshot.orders}
            alerts={snapshot.alerts}
          />
        </section>
      </div>
    </AppShell>
  );
}

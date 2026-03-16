"use client";

import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { SectorMachineInsight } from "@/lib/sector-insights";
import { formatCompactNumber, formatPercentage } from "@/lib/formatters";
import { getMachineStatusMeta } from "@/lib/status-meta";

type SectorMachineGridProps = {
  machines: SectorMachineInsight[];
};

export function SectorMachineGrid({ machines }: SectorMachineGridProps) {
  return (
    <SectionCard
      title="Maquinas monitoradas"
      description="Ativos criticos acompanhados por status, eficiencia estimada e janela de manutencao."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {machines.map((machine) => {
          const statusMeta = getMachineStatusMeta(machine.status);

          return (
            <article
              key={machine.id}
              className="rounded-[24px] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      {machine.code}
                    </p>
                    <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                  </div>
                  <h4 className="mt-3 text-base font-medium">{machine.name}</h4>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {machine.lineName}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    Eficiencia
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatPercentage(machine.efficiency / 100)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric
                  label="Runtime hoje"
                  value={`${formatCompactNumber(machine.runtimeTodayMinutes)} min`}
                />
                <Metric label="Janela MP" value={machine.maintenanceWindow} />
              </div>

              <div className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
                <p>
                  OP vinculada:{" "}
                  <span className="text-white">
                    {machine.currentOrderNumber ?? "Sem alocacao imediata"}
                  </span>
                </p>
                {machine.lastStopReason ? (
                  <p className="mt-2">{machine.lastStopReason}</p>
                ) : null}
              </div>
            </article>
          );
        })}
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

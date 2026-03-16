import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProductionSector } from "@/domain/production/types";
import { formatCompactNumber, formatPercentage } from "@/lib/formatters";
import { buildSectorsHref } from "@/lib/navigation";
import { getSectorStatusMeta } from "@/lib/status-meta";

type SectorMonitoringGridProps = {
  sectors: ProductionSector[];
};

export function SectorMonitoringGrid({
  sectors,
}: SectorMonitoringGridProps) {
  return (
    <SectionCard
      title="Monitoramento por setor"
      description="Leitura rapida das celulas produtivas com volume atual, meta, eficiencia e alertas."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {sectors.map((sector) => {
          const statusMeta = getSectorStatusMeta(sector.status);
          const completion = Math.min(
            (sector.actualDailyOutput / sector.plannedDailyOutput) * 100,
            100,
          );

          return (
            <Link
              key={sector.key}
              href={buildSectorsHref({ sector: sector.key })}
              className="block rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-5 transition-colors hover:border-[color:var(--accent)] hover:bg-white/6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                    {sector.key}
                  </p>
                  <h4 className="mt-2 text-xl font-semibold">{sector.name}</h4>
                </div>
                <StatusBadge
                  label={statusMeta.label}
                  tone={statusMeta.tone}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Producao atual" value={`${formatCompactNumber(sector.actualDailyOutput)} pcs`} />
                <Metric label="Meta" value={`${formatCompactNumber(sector.plannedDailyOutput)} pcs`} />
                <Metric label="Eficiencia" value={formatPercentage(sector.efficiency / 100)} />
                <Metric label="Maquinas" value={`${sector.machinesRunning}/${sector.machinesTotal}`} />
              </div>

              <div className="mt-5 h-2.5 rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6a6,#77d7d3)]"
                  style={{ width: `${Math.max(completion, 4)}%` }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
                <span>{sector.activeOrders} OPs ativas</span>
                <span>{sector.alertCount} alertas</span>
                <span>{sector.defects} defeitos</span>
              </div>
            </Link>
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
    <div className="rounded-2xl border border-white/6 bg-white/4 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-base font-medium">{value}</p>
    </div>
  );
}

"use client";

import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { SectorLineInsight } from "@/lib/sector-insights";
import { formatCompactNumber, formatPercentage } from "@/lib/formatters";
import { getLineStatusMeta } from "@/lib/status-meta";

type SectorLineBoardProps = {
  lines: SectorLineInsight[];
};

export function SectorLineBoard({ lines }: SectorLineBoardProps) {
  return (
    <SectionCard
      title="Linhas monitoradas"
      description="Leitura por celula com supervisao, ritmo, carga em fila e presenca operacional."
    >
      <div className="space-y-3">
        {lines.map((line) => {
          const statusMeta = getLineStatusMeta(line.status);

          return (
            <article
              key={line.id}
              className="rounded-[26px] border border-white/8 bg-white/4 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      {line.name}
                    </p>
                    <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                  </div>
                  <p className="mt-3 text-lg font-medium">{line.supervisorName}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Supervisor da celula
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    Eficiencia
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatPercentage(line.efficiency / 100)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Meta hora" value={`${formatCompactNumber(line.targetPerHour)} pcs`} />
                <Metric label="Takt" value={`${line.taktTimeSeconds}s`} />
                <Metric
                  label="Operadores"
                  value={`${line.operatorsPresent}/${line.operatorCount}`}
                />
                <Metric
                  label="Fila"
                  value={`${formatCompactNumber(line.backlogUnits)} pcs`}
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted)]">
                <span>{line.alertCount} alertas vinculados</span>
                <span className="text-white/20">/</span>
                <span>{line.orderNumbers.length} OPs na linha</span>
                <span className="text-white/20">/</span>
                <span>{line.orderNumbers.join(", ") || "Sem OP ativa"}</span>
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
    <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

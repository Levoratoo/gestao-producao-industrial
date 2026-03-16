import type { ProductionSnapshot } from "@/domain/production/types";
import { getScenarioPreset } from "@/domain/production/scenarios";
import { formatCompactNumber, formatPercentage } from "@/lib/formatters";
import { Building2, Clock3, Shirt, TimerReset } from "lucide-react";

type FactoryStatusBannerProps = {
  snapshot: ProductionSnapshot;
};

export function FactoryStatusBanner({
  snapshot,
}: FactoryStatusBannerProps) {
  const scenario = getScenarioPreset(snapshot.scenarioKey);

  return (
    <section className="metric-shadow panel-sheen glass-blur fade-up rounded-[34px] border border-[color:var(--line)] bg-[linear-gradient(130deg,rgba(62,166,166,0.14),rgba(9,19,29,0.4) 40%,rgba(239,188,104,0.12))] p-6 sm:p-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent)]">
            Status geral da fabrica
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[0.01em] sm:text-[2rem]">
            Turno {snapshot.shiftLabel} com {formatPercentage(snapshot.projectedCompletion / 100)} de
            aderencia a projecao do dia
          </h3>
          <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
            A Rosa Maria opera com mix de {snapshot.productMix} produtos e foco
            em estabilidade do fluxo entre corte, costura, acabamento e
            expedicao. Cenario atual: {scenario.label}. Os dados abaixo sao
            simulados, mas seguem regras operacionais coerentes de capacidade,
            atraso e qualidade.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px]">
          <InfoChip
            icon={Clock3}
            label="Turno ativo"
            value={snapshot.shiftLabel}
          />
          <InfoChip
            icon={Shirt}
            label="Mix atual"
            value={`${snapshot.productMix} SKUs`}
          />
          <InfoChip
            icon={TimerReset}
            label="Producao expedida"
            value={`${formatCompactNumber(snapshot.dailyProduced)} pecas`}
          />
          <InfoChip
            icon={Building2}
            label="Cenario"
            value={scenario.shortLabel}
          />
        </div>
      </div>
    </section>
  );
}

type InfoChipProps = {
  icon: typeof Clock3;
  label: string;
  value: string;
};

function InfoChip({ icon: Icon, label, value }: InfoChipProps) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/6">
          <Icon className="h-4 w-4 text-[color:var(--accent)]" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
            {label}
          </p>
          <p className="mt-1 text-sm font-medium">{value}</p>
        </div>
      </div>
    </div>
  );
}

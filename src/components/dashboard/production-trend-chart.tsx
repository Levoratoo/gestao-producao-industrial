import { SectionCard } from "@/components/shared/section-card";
import type { HourlyProductionPoint } from "@/domain/production/types";
import { formatCompactNumber } from "@/lib/formatters";

type ProductionTrendChartProps = {
  points: HourlyProductionPoint[];
};

export function ProductionTrendChart({
  points,
}: ProductionTrendChartProps) {
  const chartHeight = 240;
  const chartWidth = 680;
  const maxValue = Math.max(
    ...points.flatMap((point) => [point.produced, point.target]),
  );

  const actualPath = buildLinePath(points, chartWidth, chartHeight, maxValue, "produced");
  const targetPath = buildLinePath(points, chartWidth, chartHeight, maxValue, "target");
  const areaPath = buildAreaPath(points, chartWidth, chartHeight, maxValue);

  return (
    <SectionCard
      title="Producao por hora"
      description="Comparativo entre a producao realizada e a curva alvo do turno para avaliar ritmo operacional."
    >
      <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-[color:var(--muted)]">
          <div className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
            Producao realizada
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--warning)]" />
            Curva alvo
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-[260px] w-full min-w-[620px]"
            role="img"
            aria-label="Grafico de producao por hora"
          >
            <defs>
              <linearGradient
                id="actualArea"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgba(62, 166, 166, 0.35)" />
                <stop offset="100%" stopColor="rgba(62, 166, 166, 0.02)" />
              </linearGradient>
            </defs>

            {Array.from({ length: 5 }).map((_, index) => {
              const y = 24 + index * 48;
              return (
                <line
                  key={y}
                  x1="0"
                  x2={chartWidth}
                  y1={y}
                  y2={y}
                  stroke="rgba(151,167,184,0.12)"
                  strokeDasharray="4 8"
                />
              );
            })}

            <path d={areaPath} fill="url(#actualArea)" />
            <path
              d={actualPath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d={targetPath}
              fill="none"
              stroke="var(--warning)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="10 10"
            />

            {points.map((point, index) => {
              const x = getChartX(index, points.length, chartWidth);
              const y = getChartY(point.produced, chartHeight, maxValue);

              return (
                <g key={point.label}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill="var(--accent)"
                    stroke="rgba(6,14,22,0.9)"
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    fill="rgba(151,167,184,0.82)"
                    fontSize="12"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {points.slice(-3).map((point) => (
            <div
              key={point.label}
              className="rounded-2xl border border-white/8 bg-white/4 p-4"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {point.label}
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatCompactNumber(point.produced)} pecas
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Meta horaria {formatCompactNumber(point.target)} pecas
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function buildLinePath(
  points: HourlyProductionPoint[],
  width: number,
  height: number,
  maxValue: number,
  field: "produced" | "target",
) {
  return points
    .map((point, index) => {
      const x = getChartX(index, points.length, width);
      const y = getChartY(point[field], height, maxValue);

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(
  points: HourlyProductionPoint[],
  width: number,
  height: number,
  maxValue: number,
) {
  const top = points
    .map((point, index) => {
      const x = getChartX(index, points.length, width);
      const y = getChartY(point.produced, height, maxValue);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const lastX = getChartX(points.length - 1, points.length, width);
  const firstX = getChartX(0, points.length, width);
  const baseline = height - 26;

  return `${top} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
}

function getChartX(index: number, count: number, width: number) {
  if (count <= 1) {
    return width / 2;
  }

  const padding = 28;
  return padding + (index * (width - padding * 2)) / (count - 1);
}

function getChartY(value: number, height: number, maxValue: number) {
  const chartTop = 20;
  const chartBottom = height - 40;
  const usableHeight = chartBottom - chartTop;

  return chartBottom - (value / maxValue) * usableHeight;
}

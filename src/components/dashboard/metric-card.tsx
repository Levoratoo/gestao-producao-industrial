import type { LucideIcon } from "lucide-react";

type MetricTone = "success" | "warning" | "info";

type MetricCardProps = {
  title: string;
  value: string;
  caption: string;
  trend: string;
  icon: LucideIcon;
  tone: MetricTone;
  progress: number;
};

const toneClasses: Record<MetricTone, string> = {
  success: "text-[color:var(--success)] border-[color:var(--success)]/20 bg-[color:var(--success-soft)]",
  warning: "text-[color:var(--warning)] border-[color:var(--warning)]/20 bg-[color:var(--warning-soft)]",
  info: "text-[color:var(--info)] border-[color:var(--info)]/20 bg-[color:var(--info-soft)]",
};

export function MetricCard({
  title,
  value,
  caption,
  trend,
  icon: Icon,
  tone,
  progress,
}: MetricCardProps) {
  return (
    <article className="metric-shadow panel-sheen glass-blur fade-up rounded-[28px] border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[color:var(--muted)]">{title}</p>
          <p className="mt-4 text-[2rem] font-semibold leading-none tracking-[0.01em]">
            {value}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">{caption}</p>
      <div className="mt-4 h-2 rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${
            tone === "warning"
              ? "bg-[linear-gradient(90deg,#efbc68,#f4d9a5)]"
              : tone === "info"
                ? "bg-[linear-gradient(90deg,#73a8f8,#9bc4ff)]"
                : "bg-[linear-gradient(90deg,#70bf76,#9be06b)]"
          }`}
          style={{ width: `${Math.max(Math.min(progress, 100), 4)}%` }}
        />
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">
        {trend}
      </p>
    </article>
  );
}

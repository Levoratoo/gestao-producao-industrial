type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

type StatusBadgeProps = {
  label: string;
  tone: StatusTone;
};

const toneClasses: Record<StatusTone, string> = {
  success:
    "border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  warning:
    "border-[color:var(--warning)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  danger:
    "border-[color:var(--danger)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  info: "border-[color:var(--info)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  neutral: "border-white/10 bg-white/5 text-[color:var(--muted)]",
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

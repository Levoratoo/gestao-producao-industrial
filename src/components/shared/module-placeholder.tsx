import { Layers3 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

type ModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
};

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  bullets,
}: ModulePlaceholderProps) {
  return (
    <AppShell
      eyebrow={eyebrow}
      title={title}
      subtitle={description}
      meta={
        <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-xs text-[color:var(--muted)]">
          Estrutura criada para evolucao incremental
        </div>
      }
    >
      <section className="metric-shadow panel-sheen glass-blur fade-up rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6">
              <Layers3 className="h-6 w-6 text-[color:var(--accent)]" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
            <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
              {description}
            </p>
          </div>

          <div className="w-full max-w-xl rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-[color:var(--accent)]">
              Planejamento
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--muted)]">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="rounded-2xl border border-white/6 bg-white/4 px-4 py-3"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <section
      className={`metric-shadow panel-sheen glass-blur fade-up rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-5 sm:p-6 ${className}`}
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-[0.01em]">{title}</h3>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

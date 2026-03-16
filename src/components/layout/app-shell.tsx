"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardList,
  Factory,
  GitBranch,
  LayoutDashboard,
  PencilRuler,
  ScanLine,
} from "lucide-react";
import { SimulationControlBar } from "@/components/layout/simulation-control-bar";
import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

const navigationItems = [
  {
    href: "/",
    label: "Dashboard",
    description: "Operacao em tempo real",
    icon: LayoutDashboard,
  },
  {
    href: "/ordens",
    label: "Ordens",
    description: "Carteira e andamento",
    icon: ClipboardList,
  },
  {
    href: "/apontamentos",
    label: "Apontamentos",
    description: "Lancamentos manuais",
    icon: PencilRuler,
  },
  {
    href: "/fluxo",
    label: "Fluxo",
    description: "Do tecnico ao embarque",
    icon: GitBranch,
  },
  {
    href: "/setores",
    label: "Setores",
    description: "Monitoramento operacional",
    icon: ScanLine,
  },
  {
    href: "/alertas",
    label: "Alertas",
    description: "Ocorrencias e desvios",
    icon: Bell,
  },
] as const;

export function AppShell({
  title,
  subtitle,
  eyebrow,
  meta,
  actions,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="app-grid min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-4 px-4 py-4 lg:px-6">
        <aside className="metric-shadow panel-sheen glass-blur sticky top-4 hidden h-[calc(100vh-2rem)] w-[290px] shrink-0 flex-col rounded-[32px] border border-[color:var(--line)] bg-[color:var(--panel)] p-6 lg:flex">
          <div className="fade-up">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(145deg,#173046,#0d1f30)]">
                <Factory className="h-7 w-7 text-[color:var(--accent)]" />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                  Rosa Maria
                </p>
                <h1 className="text-xl font-semibold tracking-[0.02em]">
                  Industrial Ops
                </h1>
              </div>
            </div>
            <div className="rounded-3xl border border-white/6 bg-white/4 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Modo demonstrativo
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                Dados simulados com progressao controlada e arquitetura pronta
                para integracoes futuras com ERP, chao de fabrica e APIs.
              </p>
            </div>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-2">
            {navigationItems.map((item, index) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`fade-up group flex items-start gap-4 rounded-2xl border px-4 py-4 transition-all duration-200 ${
                    isActive
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-white"
                      : "border-transparent bg-transparent text-[color:var(--muted)] hover:border-white/8 hover:bg-white/4 hover:text-white"
                  }`}
                  style={{ animationDelay: `${0.08 * index}s` }}
                >
                  <div
                    className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border ${
                      isActive
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                        : "border-white/8 bg-white/4"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-inherit/80">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="rounded-3xl border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
              Arquitetura
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
              <li>Frontend em Next.js App Router</li>
              <li>Mocks e simulador separados por dominio</li>
              <li>Pronto para evoluir para backend Node/API</li>
            </ul>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="metric-shadow panel-sheen glass-blur rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  {eyebrow ? (
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[color:var(--accent)]">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h2 className="mt-2 text-3xl font-semibold tracking-[0.01em] sm:text-[2rem]">
                    {title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--muted)] sm:text-[15px]">
                    {subtitle}
                  </p>
                </div>
                <div className="flex flex-col gap-3 lg:items-end">
                  {meta ? <div>{meta}</div> : null}
                  {actions ? <div>{actions}</div> : null}
                </div>
              </div>

              <SimulationControlBar />

              <div className="scrollbar-thin -mx-1 overflow-x-auto lg:hidden">
                <nav className="flex min-w-max gap-2 px-1">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                          isActive
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-white"
                            : "border-white/8 bg-white/4 text-[color:var(--muted)]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          </header>

          <main className="pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

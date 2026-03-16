"use client";

import {
  PauseCircle,
  PlayCircle,
  RotateCcw,
  SkipForward,
  TimerReset,
} from "lucide-react";
import {
  useProductionSimulation,
  useProductionSimulationActions,
  useProductionSimulationControls,
} from "@/hooks/use-production-simulation";
import { formatDateTimeShort } from "@/lib/formatters";
import { getScenarioPreset } from "@/domain/production/scenarios";

const speedOptions = [
  {
    key: "slow",
    label: "0.5x",
    caption: "Lento",
  },
  {
    key: "normal",
    label: "1x",
    caption: "Normal",
  },
  {
    key: "fast",
    label: "2x",
    caption: "Rapido",
  },
] as const;

export function SimulationControlBar() {
  const snapshot = useProductionSimulation();
  const controls = useProductionSimulationControls();
  const actions = useProductionSimulationActions();
  const activeScenario = getScenarioPreset(controls.scenarioKey);

  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Sincronizacao
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
              {controls.isPaused ? (
                <PauseCircle className="h-4 w-4 text-[color:var(--warning)]" />
              ) : (
                <PlayCircle className="h-4 w-4 text-[color:var(--success)]" />
              )}
              {controls.isPaused ? "Atualizacao pausada" : "Atualizacao em execucao"}
            </p>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              {controls.connectionStatus === "local"
                ? "Cliente local"
                : controls.connectionStatus === "connected"
                  ? "SSE conectado"
                  : controls.connectionStatus === "connecting"
                    ? "Conectando ao backend"
                    : controls.connectionStatus === "degraded"
                      ? "Fallback por polling"
                      : "Desconectado"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Relogio operacional
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatDateTimeShort(snapshot.currentTime)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Cenario ativo
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {activeScenario.label}
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Tick atual
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              #{String(snapshot.tick).padStart(2, "0")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap gap-2">
            {controls.scenarios.map((scenario) => {
              const isActive = controls.scenarioKey === scenario.key;

              return (
                <button
                  key={scenario.key}
                  type="button"
                  onClick={() => actions.applyScenario(scenario.key)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-white"
                      : "border-white/8 bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:border-white/16 hover:text-white"
                  }`}
                  title={scenario.description}
                >
                  {scenario.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {speedOptions.map((option) => {
              const isActive = controls.speedKey === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => actions.setSimulationSpeed(option.key)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-white"
                      : "border-white/8 bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:border-white/16 hover:text-white"
                  }`}
                >
                  {option.label} {option.caption}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={actions.togglePaused}
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
            >
              {controls.isPaused ? (
                <PlayCircle className="h-4 w-4" />
              ) : (
                <PauseCircle className="h-4 w-4" />
              )}
              {controls.isPaused ? "Retomar" : "Pausar"}
            </button>

            <button
              type="button"
              onClick={actions.stepSimulation}
              disabled={!controls.isPaused}
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <SkipForward className="h-4 w-4" />
              Avancar 1 ciclo
            </button>

            <button
              type="button"
              onClick={actions.resetSimulation}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--warning)] bg-[color:var(--warning-soft)] px-4 py-2 text-sm text-[color:var(--warning)] transition-colors hover:bg-[color:var(--warning)]/12"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar demo
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
            <TimerReset className="h-4 w-4" />
            {controls.gatewayMode === "api"
              ? "Estado sincronizado com backend e persistido pelo servidor."
              : "Estado persistido localmente no navegador."}
            <span className="text-white/20">/</span>
            <span>Gateway {controls.gatewayMode === "api" ? "API" : "Local"}</span>
            {controls.lastError ? (
              <>
                <span className="text-white/20">/</span>
                <span className="text-[color:var(--warning)]">{controls.lastError}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

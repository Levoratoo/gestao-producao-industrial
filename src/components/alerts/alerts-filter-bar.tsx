"use client";

import type { AlertSeverity, AlertSource, SectorKey } from "@/domain/production/types";
import { getSectorLabel } from "@/lib/status-meta";

type AlertsFilterBarProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  severityFilter: AlertSeverity | "todas";
  onSeverityFilterChange: (value: AlertSeverity | "todas") => void;
  sectorFilter: SectorKey | "todos";
  onSectorFilterChange: (value: SectorKey | "todos") => void;
  sourceFilter: AlertSource | "todas";
  onSourceFilterChange: (value: AlertSource | "todas") => void;
  stateFilter: "ativos" | "historico" | "todos";
  onStateFilterChange: (value: "ativos" | "historico" | "todos") => void;
  activeCount: number;
  historyCount: number;
  onReset: () => void;
  hasActiveFilters: boolean;
  availableSectors: SectorKey[];
};

export function AlertsFilterBar({
  searchQuery,
  onSearchQueryChange,
  severityFilter,
  onSeverityFilterChange,
  sectorFilter,
  onSectorFilterChange,
  sourceFilter,
  onSourceFilterChange,
  stateFilter,
  onStateFilterChange,
  activeCount,
  historyCount,
  onReset,
  hasActiveFilters,
  availableSectors,
}: AlertsFilterBarProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
        <label className="text-sm">
          <span className="mb-2 block text-[color:var(--muted)]">Buscar alerta</span>
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Titulo, OP, setor ou motivo"
            className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none transition-colors placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)]"
          />
        </label>

        <SelectField
          label="Criticidade"
          value={severityFilter}
          onChange={(value) => onSeverityFilterChange(value as AlertSeverity | "todas")}
          options={[
            { value: "todas", label: "Todas" },
            { value: "high", label: "Critico" },
            { value: "medium", label: "Medio" },
            { value: "info", label: "Informativo" },
          ]}
        />

        <SelectField
          label="Setor"
          value={sectorFilter}
          onChange={(value) => onSectorFilterChange(value as SectorKey | "todos")}
          options={[
            { value: "todos", label: "Todos" },
            ...availableSectors.map((sector) => ({
              value: sector,
              label: getSectorLabel(sector),
            })),
          ]}
        />

        <SelectField
          label="Origem"
          value={sourceFilter}
          onChange={(value) => onSourceFilterChange(value as AlertSource | "todas")}
          options={[
            { value: "todas", label: "Todas" },
            { value: "simulation", label: "Simulacao" },
            { value: "manual", label: "Manual" },
          ]}
        />

        <SelectField
          label="Estado"
          value={stateFilter}
          onChange={(value) => onStateFilterChange(value as "ativos" | "historico" | "todos")}
          options={[
            { value: "ativos", label: `Ativos (${activeCount})` },
            { value: "historico", label: `Historico (${historyCount})` },
            { value: "todos", label: "Tudo" },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatChip label="Ativos" value={String(activeCount).padStart(2, "0")} />
          <StatChip label="Historico" value={String(historyCount).padStart(2, "0")} />
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="text-sm">
      <span className="mb-2 block text-[color:var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
      {label}: <span className="text-white">{value}</span>
    </div>
  );
}

"use client";

import type { ProductionOrder, SectorKey } from "@/domain/production/types";
import { Search, SlidersHorizontal } from "lucide-react";

type OrderStatusFilter = ProductionOrder["status"] | "todos";
type OrderPriorityFilter = ProductionOrder["priority"] | "todas";
type OrderSectorFilter = SectorKey | "todos";

type FilterOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type OrdersFilterBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: OrderStatusFilter;
  onStatusFilterChange: (value: OrderStatusFilter) => void;
  statusOptions: FilterOption<OrderStatusFilter>[];
  sectorFilter: OrderSectorFilter;
  onSectorFilterChange: (value: OrderSectorFilter) => void;
  sectorOptions: FilterOption<OrderSectorFilter>[];
  priorityFilter: OrderPriorityFilter;
  onPriorityFilterChange: (value: OrderPriorityFilter) => void;
  priorityOptions: FilterOption<OrderPriorityFilter>[];
  onlyOpenOrders: boolean;
  onOnlyOpenOrdersChange: (value: boolean) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
};

export function OrdersFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  sectorFilter,
  onSectorFilterChange,
  sectorOptions,
  priorityFilter,
  onPriorityFilterChange,
  priorityOptions,
  onlyOpenOrders,
  onOnlyOpenOrdersChange,
  onResetFilters,
  hasActiveFilters,
}: OrdersFilterBarProps) {
  return (
    <div className="space-y-4 rounded-[28px] border border-white/8 bg-white/4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por OP, produto ou linha"
            className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-11 py-3 text-sm text-white outline-none transition-colors placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--muted)]">
            <input
              type="checkbox"
              checked={onlyOpenOrders}
              onChange={(event) => onOnlyOpenOrdersChange(event.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-transparent accent-[color:var(--accent)]"
            />
            Somente ativas
          </label>
          <button
            type="button"
            onClick={onResetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <FilterGroup
          title="Status"
          activeValue={statusFilter}
          options={statusOptions}
          onChange={onStatusFilterChange}
        />
        <FilterGroup
          title="Setor atual"
          activeValue={sectorFilter}
          options={sectorOptions}
          onChange={onSectorFilterChange}
        />
        <FilterGroup
          title="Prioridade"
          activeValue={priorityFilter}
          options={priorityOptions}
          onChange={onPriorityFilterChange}
        />
      </div>
    </div>
  );
}

type FilterGroupProps<T extends string> = {
  title: string;
  activeValue: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
};

function FilterGroup<T extends string>({
  title,
  activeValue,
  options,
  onChange,
}: FilterGroupProps<T>) {
  return (
    <div>
      <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.value === activeValue;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-white"
                  : "border-white/8 bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:border-white/16 hover:text-white"
              }`}
            >
              <span>{option.label}</span>
              {typeof option.count === "number" ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "bg-white/6 text-[color:var(--muted)]"
                  }`}
                >
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

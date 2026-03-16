"use client";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { OrderDetailPanel } from "@/components/orders/order-detail-panel";
import { OrdersFilterBar } from "@/components/orders/orders-filter-bar";
import { OrdersKpiStrip } from "@/components/orders/orders-kpi-strip";
import { OrdersTable } from "@/components/orders/orders-table";
import { ReportExportActions } from "@/components/shared/report-export-actions";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProductionOrder, SectorKey } from "@/domain/production/types";
import { useProductionSimulation } from "@/hooks/use-production-simulation";
import { formatDateTimeShort } from "@/lib/formatters";
import { compareOrdersByOperationalPriority } from "@/lib/order-helpers";
import { exportOrdersCsv, exportOrdersPdf } from "@/lib/reporting";
import { getSectorLabel } from "@/lib/status-meta";
import { useMemo, useState } from "react";

type OrderStatusFilter = ProductionOrder["status"] | "todos";
type OrderPriorityFilter = ProductionOrder["priority"] | "todas";
type OrderSectorFilter = SectorKey | "todos";

export function OrdersView() {
  const snapshot = useProductionSimulation();
  const searchParams = useSearchParams();
  const querySector = searchParams.get("sector");
  const queryOrderId = searchParams.get("orderId");
  const queryOrderNumber = searchParams.get("orderNumber");
  const sectorFromQuery =
    querySector && ["corte", "costura", "acabamento", "expedicao"].includes(querySector)
      ? (querySector as SectorKey)
      : null;
  const orderFromQuery =
    snapshot.orders.find((order) => order.id === queryOrderId) ??
    snapshot.orders.find((order) => order.number === queryOrderNumber);
  const [searchQuery, setSearchQuery] = useState(() => queryOrderNumber ?? "");
  const [statusFilter, setStatusFilter] =
    useState<OrderStatusFilter>("todos");
  const [sectorFilter, setSectorFilter] = useState<OrderSectorFilter>(
    () => orderFromQuery?.currentSector ?? sectorFromQuery ?? "todos",
  );
  const [priorityFilter, setPriorityFilter] =
    useState<OrderPriorityFilter>("todas");
  const [onlyOpenOrders, setOnlyOpenOrders] = useState(
    () => !orderFromQuery,
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    () => orderFromQuery?.id ?? null,
  );

  const statusOptions = useMemo(
    () => [
      { value: "todos" as const, label: "Todos", count: snapshot.orders.length },
      {
        value: "em_andamento" as const,
        label: "Em andamento",
        count: snapshot.orders.filter((order) => order.status === "em_andamento")
          .length,
      },
      {
        value: "atrasada" as const,
        label: "Atrasada",
        count: snapshot.orders.filter((order) => order.status === "atrasada").length,
      },
      {
        value: "parada" as const,
        label: "Parada",
        count: snapshot.orders.filter((order) => order.status === "parada").length,
      },
      {
        value: "concluida" as const,
        label: "Concluida",
        count: snapshot.orders.filter((order) => order.status === "concluida")
          .length,
      },
    ],
    [snapshot.orders],
  );

  const sectorOptions = useMemo(
    () => [
      { value: "todos" as const, label: "Todos", count: snapshot.orders.length },
      ...(["corte", "costura", "acabamento", "expedicao"] as const).map(
        (sector) => ({
          value: sector,
          label: getSectorLabel(sector),
          count: snapshot.orders.filter((order) => order.currentSector === sector)
            .length,
        }),
      ),
    ],
    [snapshot.orders],
  );

  const priorityOptions = useMemo(
    () => [
      { value: "todas" as const, label: "Todas", count: snapshot.orders.length },
      {
        value: "alta" as const,
        label: "Alta",
        count: snapshot.orders.filter((order) => order.priority === "alta").length,
      },
      {
        value: "media" as const,
        label: "Media",
        count: snapshot.orders.filter((order) => order.priority === "media").length,
      },
      {
        value: "baixa" as const,
        label: "Baixa",
        count: snapshot.orders.filter((order) => order.priority === "baixa").length,
      },
    ],
    [snapshot.orders],
  );

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return [...snapshot.orders]
      .filter((order) => {
        if (onlyOpenOrders && order.status === "concluida") {
          return false;
        }

        if (statusFilter !== "todos" && order.status !== statusFilter) {
          return false;
        }

        if (sectorFilter !== "todos" && order.currentSector !== sectorFilter) {
          return false;
        }

        if (priorityFilter !== "todas" && order.priority !== priorityFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchIndex = [
          order.number,
          order.productName,
          order.line,
        ]
          .join(" ")
          .toLowerCase();

        return searchIndex.includes(normalizedQuery);
      })
      .sort(compareOrdersByOperationalPriority);
  }, [
    onlyOpenOrders,
    priorityFilter,
    searchQuery,
    sectorFilter,
    snapshot.orders,
    statusFilter,
  ]);

  const resolvedSelectedOrderId = filteredOrders.some(
    (order) => order.id === selectedOrderId,
  )
    ? selectedOrderId
    : filteredOrders[0]?.id ?? null;

  const selectedOrder =
    filteredOrders.find((order) => order.id === resolvedSelectedOrderId) ?? null;

  const relatedAlerts = snapshot.alerts.filter((alert) => {
    if (!selectedOrder) {
      return false;
    }

    return (
      alert.orderNumber === selectedOrder.number ||
      (alert.sector === selectedOrder.currentSector && alert.severity === "high")
    );
  });

  const selectedProduct = snapshot.products.find(
    (product) => product.id === selectedOrder?.productId,
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== "todos" ||
    sectorFilter !== "todos" ||
    priorityFilter !== "todas" ||
    !onlyOpenOrders;

  const portfolioNeedsAttention = filteredOrders.some(
    (order) => order.status === "atrasada" || order.status === "parada",
  );

  return (
    <AppShell
      eyebrow="Gestao de ordens"
      title="Ordens de producao"
      subtitle="Carteira operacional da Rosa Maria com filtros por status, setor e prioridade, acompanhando o progresso das OPs e os desvios que impactam prazo e fluxo produtivo."
      meta={
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            {filteredOrders.length} OPs exibidas
          </div>
          <div className="rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)]">
            Atualizado em {formatDateTimeShort(snapshot.currentTime)}
          </div>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportExportActions
            onExportCsv={() => exportOrdersCsv(filteredOrders, snapshot.currentTime)}
            onExportPdf={() => exportOrdersPdf(filteredOrders, snapshot.currentTime)}
          />
          <StatusBadge
            label={
              portfolioNeedsAttention
                ? "Carteira com desvios"
                : "Carteira controlada"
            }
            tone={portfolioNeedsAttention ? "warning" : "success"}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <OrdersKpiStrip orders={snapshot.orders} />

        <section className="grid gap-4 xl:grid-cols-[1.6fr_0.95fr]">
          <SectionCard
            title="Carteira operacional"
            description="Lista das ordens em producao com foco em selecao rapida, leitura de prazo e acompanhamento do percentual concluido."
          >
            <OrdersFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              statusOptions={statusOptions}
              sectorFilter={sectorFilter}
              onSectorFilterChange={setSectorFilter}
              sectorOptions={sectorOptions}
              priorityFilter={priorityFilter}
              onPriorityFilterChange={setPriorityFilter}
              priorityOptions={priorityOptions}
              onlyOpenOrders={onlyOpenOrders}
              onOnlyOpenOrdersChange={setOnlyOpenOrders}
              onResetFilters={() => {
                setSearchQuery("");
                setStatusFilter("todos");
                setSectorFilter("todos");
                setPriorityFilter("todas");
                setOnlyOpenOrders(true);
              }}
              hasActiveFilters={hasActiveFilters}
            />

            <div className="mt-5">
              <OrdersTable
                orders={filteredOrders}
                currentTime={snapshot.currentTime}
                selectedOrderId={resolvedSelectedOrderId}
                onSelectOrder={setSelectedOrderId}
              />
            </div>
          </SectionCard>

          <OrderDetailPanel
            selectedOrder={selectedOrder}
            currentTime={snapshot.currentTime}
            relatedAlerts={relatedAlerts}
            product={selectedProduct}
          />
        </section>
      </div>
    </AppShell>
  );
}

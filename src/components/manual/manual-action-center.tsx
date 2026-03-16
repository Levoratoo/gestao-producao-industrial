"use client";

import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { sectorSequence } from "@/domain/production/mock-data";
import type {
  ManualEntryAction,
  SectorKey,
} from "@/domain/production/types";
import {
  useProductionSimulation,
  useProductionSimulationActions,
} from "@/hooks/use-production-simulation";
import { formatCompactNumber } from "@/lib/formatters";
import { getOrderStatusMeta, getSectorLabel } from "@/lib/status-meta";
import { useMemo, useState } from "react";

type ManualActionCenterProps = {
  className?: string;
};

const actionTabs: Array<{
  key: ManualEntryAction;
  label: string;
  description: string;
}> = [
  {
    key: "iniciar_op",
    label: "Iniciar OP",
    description: "Retoma ou inicia a ordem selecionada no setor atual.",
  },
  {
    key: "apontar_producao",
    label: "Apontar producao",
    description: "Registra quantidade produzida manualmente para a OP.",
  },
  {
    key: "registrar_parada",
    label: "Registrar parada",
    description: "Sinaliza indisponibilidade e gera impacto imediato no setor.",
  },
  {
    key: "registrar_defeito",
    label: "Qualidade",
    description: "Aponta defeitos ou retrabalho diretamente na ordem.",
  },
  {
    key: "finalizar_etapa",
    label: "Finalizar etapa",
    description: "Libera a OP para o proximo setor ou encerra o lote.",
  },
];

const downtimeReasons = [
  "Falta de material",
  "Ajuste de maquina",
  "Troca de setup",
  "Liberacao de qualidade",
  "Ausencia de operador",
];

const qualityReasons = [
  "Costura fora de padrao",
  "Falha de acabamento",
  "Medida fora de faixa",
  "Retrabalho por inspeção",
  "Ajuste de modelagem",
];

export function ManualActionCenter({ className = "" }: ManualActionCenterProps) {
  const snapshot = useProductionSimulation();
  const actions = useProductionSimulationActions();
  const [activeAction, setActiveAction] = useState<ManualEntryAction>(
    "apontar_producao",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("");
  const [quantity, setQuantity] = useState(24);
  const [durationMinutes, setDurationMinutes] = useState(18);
  const [qualityCategory, setQualityCategory] = useState<"defeito" | "retrabalho">(
    "defeito",
  );
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const openOrders = useMemo(
    () => snapshot.orders.filter((order) => order.status !== "concluida"),
    [snapshot.orders],
  );

  const resolvedOrderId = openOrders.some((order) => order.id === selectedOrderId)
    ? selectedOrderId
    : openOrders[0]?.id ?? "";

  const selectedOrder =
    openOrders.find((order) => order.id === resolvedOrderId) ?? null;

  const operatorOptions = useMemo(() => {
    if (!selectedOrder) {
      return snapshot.operators;
    }

    return snapshot.operators.filter(
      (operator) => operator.sector === selectedOrder.currentSector,
    );
  }, [selectedOrder, snapshot.operators]);

  const resolvedOperatorId = operatorOptions.some(
    (operator) => operator.id === selectedOperatorId,
  )
    ? selectedOperatorId
    : operatorOptions[0]?.id ?? "";

  const selectedOperator =
    operatorOptions.find((operator) => operator.id === resolvedOperatorId) ?? null;

  const selectedActionMeta = actionTabs.find(
    (action) => action.key === activeAction,
  )!;
  const reasonOptions =
    activeAction === "registrar_parada" ? downtimeReasons : qualityReasons;
  const resolvedReason =
    activeAction === "registrar_parada" || activeAction === "registrar_defeito"
      ? reasonOptions.includes(reason)
        ? reason
        : reasonOptions[0]
      : undefined;
  const currentSectorIndex = selectedOrder
    ? sectorSequence.indexOf(selectedOrder.currentSector)
    : -1;
  const nextSectorLabel = selectedOrder
    ? currentSectorIndex >= 0 && currentSectorIndex < sectorSequence.length - 1
      ? getSectorLabel(sectorSequence[currentSectorIndex + 1] as SectorKey)
      : "Encerramento do lote"
    : "Sem OP selecionada";

  const handleSubmit = () => {
    if (!selectedOrder || !selectedOperator) {
      return;
    }

    if (activeAction === "iniciar_op") {
      actions.startOrder({
        orderId: selectedOrder.id,
        operatorId: selectedOperator.id,
        note: note.trim() || undefined,
      });
      setFeedbackMessage(`OP ${selectedOrder.number} iniciada por ${selectedOperator.name}.`);
      setNote("");
      return;
    }

    if (activeAction === "apontar_producao") {
      actions.reportProduction({
        orderId: selectedOrder.id,
        operatorId: selectedOperator.id,
        quantity,
        note: note.trim() || undefined,
      });
      setFeedbackMessage(
        `${formatCompactNumber(quantity)} pecas registradas em ${selectedOrder.number}.`,
      );
      setNote("");
      return;
    }

    if (activeAction === "registrar_parada") {
      actions.registerDowntime({
        orderId: selectedOrder.id,
        operatorId: selectedOperator.id,
        durationMinutes,
        reason: resolvedReason ?? downtimeReasons[0],
        note: note.trim() || undefined,
      });
      setFeedbackMessage(
        `Parada de ${durationMinutes} min registrada para ${selectedOrder.number}.`,
      );
      setNote("");
      return;
    }

    if (activeAction === "registrar_defeito") {
      actions.registerQuality({
        orderId: selectedOrder.id,
        operatorId: selectedOperator.id,
        quantity,
        category: qualityCategory,
        reason: resolvedReason ?? qualityReasons[0],
        note: note.trim() || undefined,
      });
      setFeedbackMessage(
        `${formatCompactNumber(quantity)} pecas registradas em ${qualityCategory} para ${selectedOrder.number}.`,
      );
      setNote("");
      return;
    }

    actions.finalizeStage({
      orderId: selectedOrder.id,
      operatorId: selectedOperator.id,
      note: note.trim() || undefined,
    });
    setFeedbackMessage(`Etapa finalizada para ${selectedOrder.number}.`);
    setNote("");
  };

  const selectedOrderStatusMeta = selectedOrder
    ? getOrderStatusMeta(selectedOrder.status)
    : null;

  return (
    <SectionCard
      title="Central de apontamentos"
      description="Registre producao, paradas, qualidade e transicoes de etapa usando a mesma base operacional do dashboard."
      className={className}
      action={
        feedbackMessage ? (
          <div className="rounded-full border border-[color:var(--success)] bg-[color:var(--success-soft)] px-4 py-2 text-xs text-[color:var(--success)]">
            {feedbackMessage}
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {actionTabs.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => setActiveAction(action.key)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                activeAction === action.key
                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-white"
                  : "border-white/8 bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:border-white/16 hover:text-white"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="rounded-[28px] border border-white/8 bg-white/4 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
            {selectedActionMeta.label}
          </p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            {selectedActionMeta.description}
          </p>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <label className="text-sm">
              <span className="mb-2 block text-[color:var(--muted)]">Ordem de producao</span>
              <select
                value={resolvedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
                className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
              >
                {openOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.number} - {order.productName}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-[color:var(--muted)]">Operador responsavel</span>
              <select
                value={resolvedOperatorId}
                onChange={(event) => setSelectedOperatorId(event.target.value)}
                className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
              >
                {operatorOptions.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name} - {getSectorLabel(operator.sector)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedOrder ? (
            <div className="mt-5 rounded-[24px] border border-white/8 bg-[color:var(--panel-strong)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {selectedOrder.number}
                </p>
                {selectedOrderStatusMeta ? (
                  <StatusBadge
                    label={selectedOrderStatusMeta.label}
                    tone={selectedOrderStatusMeta.tone}
                  />
                ) : null}
                <StatusBadge
                  label={getSectorLabel(selectedOrder.currentSector)}
                  tone="info"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InfoMetric
                  label="Produto"
                  value={selectedOrder.productName}
                />
                <InfoMetric
                  label="Planejado"
                  value={`${formatCompactNumber(selectedOrder.plannedQuantity)} pecas`}
                />
                <InfoMetric
                  label="Produzido"
                  value={`${formatCompactNumber(selectedOrder.producedQuantity)} pecas`}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {activeAction === "apontar_producao" || activeAction === "registrar_defeito" ? (
              <label className="text-sm">
                <span className="mb-2 block text-[color:var(--muted)]">
                  Quantidade
                </span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
                />
              </label>
            ) : null}

            {activeAction === "registrar_parada" ? (
              <label className="text-sm">
                <span className="mb-2 block text-[color:var(--muted)]">
                  Duracao da parada (min)
                </span>
                <input
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
                />
              </label>
            ) : null}

            {activeAction === "registrar_defeito" ? (
              <label className="text-sm">
                <span className="mb-2 block text-[color:var(--muted)]">Categoria</span>
                <select
                  value={qualityCategory}
                  onChange={(event) =>
                    setQualityCategory(event.target.value as "defeito" | "retrabalho")
                  }
                  className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
                >
                  <option value="defeito">Defeito</option>
                  <option value="retrabalho">Retrabalho</option>
                </select>
              </label>
            ) : null}

            {activeAction === "registrar_parada" || activeAction === "registrar_defeito" ? (
              <label className="text-sm xl:col-span-2">
                <span className="mb-2 block text-[color:var(--muted)]">Motivo</span>
                <select
                  value={resolvedReason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
                >
                  {reasonOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {activeAction === "finalizar_etapa" ? (
              <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--muted)] xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em]">Proxima destinacao</p>
                <p className="mt-2 text-base font-medium text-white">{nextSectorLabel}</p>
              </div>
            ) : null}
          </div>

          <label className="mt-5 block text-sm">
            <span className="mb-2 block text-[color:var(--muted)]">Observacao</span>
            <textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Contexto adicional do apontamento"
              className="w-full rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] px-4 py-3 text-white outline-none transition-colors placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)]"
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[color:var(--muted)]">
              {selectedOperator ? `Operador selecionado: ${selectedOperator.name}` : "Nenhum operador disponivel"}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedOrder || !selectedOperator}
              className="rounded-full border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[color:var(--accent)]/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {getSubmitLabel(activeAction)}
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function getSubmitLabel(action: ManualEntryAction) {
  const labels = {
    iniciar_op: "Registrar inicio da OP",
    apontar_producao: "Lancar producao",
    registrar_parada: "Confirmar parada",
    registrar_defeito: "Registrar qualidade",
    finalizar_etapa: "Finalizar etapa",
  } as const;

  return labels[action];
}

type InfoMetricProps = {
  label: string;
  value: string;
};

function InfoMetric({ label, value }: InfoMetricProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

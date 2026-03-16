import type { ProductionOrder } from "@/domain/production/types";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export function getOrderCompletion(order: ProductionOrder) {
  return order.producedQuantity / order.plannedQuantity;
}

export function getOrderCompletionPercent(order: ProductionOrder) {
  return getOrderCompletion(order) * 100;
}

export function getOrderDueMeta(
  order: ProductionOrder,
  currentTime: string,
): {
  label: string;
  tone: BadgeTone;
} {
  if (order.status === "concluida") {
    return {
      label: "Encerrada",
      tone: "success",
    };
  }

  const diffMs =
    new Date(order.dueDate).getTime() - new Date(currentTime).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return {
      label: "Prazo vencido",
      tone: "danger",
    };
  }

  if (diffHours <= 6) {
    return {
      label: "Janela curta",
      tone: "warning",
    };
  }

  if (diffHours <= 24) {
    return {
      label: "Entrega hoje",
      tone: "info",
    };
  }

  return {
    label: "No prazo",
    tone: "neutral",
  };
}

export function getOrderRecommendedAction(order: ProductionOrder) {
  if (order.status === "parada") {
    return "Liberar bloqueio operacional e reprogramar a passagem da OP na celula atual.";
  }

  if (order.status === "atrasada") {
    return "Priorizar a OP no proximo slot de producao e reforcar acompanhamento do lider de setor.";
  }

  if (order.currentSector === "costura") {
    return "Monitorar balanceamento da linha para evitar acumulacao antes do acabamento.";
  }

  if (order.currentSector === "acabamento") {
    return "Garantir conferencia de qualidade para nao ampliar retrabalho na reta final.";
  }

  if (order.currentSector === "expedicao") {
    return "Acompanhar embalagem e conferencia final para liberar faturamento dentro da janela.";
  }

  return "Manter abastecimento do setor e acompanhar ritmo nominal da OP.";
}

export function compareOrdersByOperationalPriority(
  left: ProductionOrder,
  right: ProductionOrder,
) {
  const statusRank = {
    parada: 0,
    atrasada: 1,
    em_andamento: 2,
    concluida: 3,
  } as const;
  const priorityRank = {
    alta: 0,
    media: 1,
    baixa: 2,
  } as const;

  const byStatus =
    statusRank[left.status] - statusRank[right.status];

  if (byStatus !== 0) {
    return byStatus;
  }

  const byPriority =
    priorityRank[left.priority] - priorityRank[right.priority];

  if (byPriority !== 0) {
    return byPriority;
  }

  const byDueDate =
    new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();

  if (byDueDate !== 0) {
    return byDueDate;
  }

  return getOrderCompletion(left) - getOrderCompletion(right);
}

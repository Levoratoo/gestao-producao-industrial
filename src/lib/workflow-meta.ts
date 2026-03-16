import type {
  ShipmentStatus,
  WorkflowLane,
  WorkflowStageKey,
  WorkflowStageStatus,
} from "@/domain/production/types";

const workflowStageLabels: Record<WorkflowStageKey, string> = {
  desenho_tecnico: "Desenho tecnico",
  corte: "Corte",
  estamparia: "Estamparia",
  qualidade: "Qualidade",
  expedicao: "Expedicao",
  faturamento: "Faturamento",
  embarque: "Embarque",
};

const workflowLaneLabels: Record<WorkflowLane, string> = {
  engenharia: "Engenharia",
  producao: "Producao",
  qualidade: "Qualidade",
  logistica: "Logistica",
  financeiro: "Financeiro",
};

const workflowStageStatusMeta: Record<
  WorkflowStageStatus,
  { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  aguardando: { label: "Aguardando", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "info" },
  bloqueada: { label: "Bloqueada", tone: "danger" },
  pronta: { label: "Pronta", tone: "success" },
  concluida: { label: "Concluida", tone: "success" },
};

const shipmentStatusMeta: Record<
  ShipmentStatus,
  { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  aguardando_minuta: { label: "Aguardando minuta", tone: "warning" },
  pronto_para_faturar: { label: "Pronto para faturar", tone: "info" },
  faturado: { label: "Faturado", tone: "success" },
  em_carregamento: { label: "Em carregamento", tone: "info" },
  despachado: { label: "Despachado", tone: "success" },
};

export function getWorkflowStageLabel(stageKey: WorkflowStageKey) {
  return workflowStageLabels[stageKey];
}

export function getWorkflowLaneLabel(lane: WorkflowLane) {
  return workflowLaneLabels[lane];
}

export function getWorkflowStageStatusMeta(status: WorkflowStageStatus) {
  return workflowStageStatusMeta[status];
}

export function getShipmentStatusMeta(status: ShipmentStatus) {
  return shipmentStatusMeta[status];
}


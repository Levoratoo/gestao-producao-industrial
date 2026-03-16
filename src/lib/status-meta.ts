import type {
  AlertSeverity,
  AlertSource,
  LineStatus,
  ManualEntryAction,
  MachineStatus,
  ManualQualityCategory,
  OrderStatus,
  ProductionAlert,
  SectorKey,
  SectorStatus,
} from "@/domain/production/types";

export function getOrderStatusMeta(status: OrderStatus) {
  const map = {
    em_andamento: { label: "Em andamento", tone: "info" },
    atrasada: { label: "Atrasada", tone: "warning" },
    concluida: { label: "Concluida", tone: "success" },
    parada: { label: "Parada", tone: "danger" },
  } as const;

  return map[status];
}

export function getSectorStatusMeta(status: SectorStatus) {
  const map = {
    operando: { label: "Operando", tone: "success" },
    atencao: { label: "Atencao", tone: "warning" },
    parado: { label: "Parado", tone: "danger" },
    setup: { label: "Setup", tone: "neutral" },
  } as const;

  return map[status];
}

export function getLineStatusMeta(status: LineStatus) {
  const map = {
    operando: { label: "Operando", tone: "success" },
    atencao: { label: "Atencao", tone: "warning" },
    parada: { label: "Parada", tone: "danger" },
  } as const;

  return map[status];
}

export function getMachineStatusMeta(status: MachineStatus) {
  const map = {
    operando: { label: "Operando", tone: "success" },
    ajuste: { label: "Ajuste", tone: "warning" },
    parada: { label: "Parada", tone: "danger" },
    standby: { label: "Standby", tone: "neutral" },
  } as const;

  return map[status];
}

export function getAlertSeverityMeta(severity: AlertSeverity) {
  const map = {
    info: { label: "Informativo", tone: "info" },
    medium: { label: "Medio", tone: "warning" },
    high: { label: "Critico", tone: "danger" },
  } as const;

  return map[severity];
}

export function getAlertSourceMeta(source: AlertSource) {
  const map = {
    simulation: { label: "Simulacao", tone: "info" },
    manual: { label: "Manual", tone: "warning" },
  } as const;

  return map[source];
}

export function getPriorityMeta(priority: "alta" | "media" | "baixa") {
  const map = {
    alta: { label: "Alta", tone: "danger" },
    media: { label: "Media", tone: "warning" },
    baixa: { label: "Baixa", tone: "info" },
  } as const;

  return map[priority];
}

export function getAlertTypeLabel(type: ProductionAlert["type"]) {
  const map = {
    maquina_parada: "Maquina parada",
    op_atrasada: "OP atrasada",
    eficiencia_baixa: "Eficiencia baixa",
    retrabalho: "Retrabalho",
    suprimento: "Suprimento",
  } as const;

  return map[type];
}

export function getManualActionMeta(action: ManualEntryAction) {
  const map = {
    iniciar_op: { label: "Inicio OP", tone: "success" },
    apontar_producao: { label: "Producao", tone: "info" },
    registrar_parada: { label: "Parada", tone: "danger" },
    registrar_defeito: { label: "Qualidade", tone: "warning" },
    finalizar_etapa: { label: "Finalizacao", tone: "success" },
  } as const;

  return map[action];
}

export function getManualQualityCategoryLabel(
  category: ManualQualityCategory,
) {
  const map = {
    defeito: "Defeito",
    retrabalho: "Retrabalho",
  } as const;

  return map[category];
}

export function getSectorLabel(sector: SectorKey) {
  const map: Record<SectorKey, string> = {
    corte: "Corte",
    costura: "Costura",
    acabamento: "Acabamento",
    expedicao: "Expedicao",
  };

  return map[sector];
}

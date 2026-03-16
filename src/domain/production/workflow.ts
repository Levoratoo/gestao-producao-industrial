import type {
  OrderProcessFlow,
  OrderWorkflowStage,
  ProcessStageOverview,
  ProductionAlert,
  ProductionOrder,
  ProductionSnapshot,
  ShipmentManifest,
  ShipmentStatus,
  WorkflowDocument,
  WorkflowDocumentStatus,
  WorkflowLane,
  WorkflowStageKey,
  WorkflowStageStatus,
} from "./types";

type WorkflowSourceSnapshot = Omit<
  ProductionSnapshot,
  "processStages" | "orderFlows" | "shipmentManifests"
> &
  Partial<
    Pick<ProductionSnapshot, "processStages" | "orderFlows" | "shipmentManifests">
  >;

type StageDefinition = {
  key: WorkflowStageKey;
  label: string;
  shortLabel: string;
  lane: WorkflowLane;
  ownerTeam: string;
  slaHours: number;
  nextStage?: WorkflowStageKey;
};

const workflowStageDefinitions: StageDefinition[] = [
  {
    key: "desenho_tecnico",
    label: "Desenho tecnico",
    shortLabel: "Desenho",
    lane: "engenharia",
    ownerTeam: "Engenharia do produto",
    slaHours: 8,
    nextStage: "corte",
  },
  {
    key: "corte",
    label: "Corte",
    shortLabel: "Corte",
    lane: "producao",
    ownerTeam: "Preparacao e corte",
    slaHours: 10,
    nextStage: "estamparia",
  },
  {
    key: "estamparia",
    label: "Estamparia",
    shortLabel: "Estampa",
    lane: "producao",
    ownerTeam: "Estamparia industrial",
    slaHours: 14,
    nextStage: "qualidade",
  },
  {
    key: "qualidade",
    label: "Qualidade",
    shortLabel: "Qualidade",
    lane: "qualidade",
    ownerTeam: "Controle de qualidade",
    slaHours: 6,
    nextStage: "expedicao",
  },
  {
    key: "expedicao",
    label: "Expedicao",
    shortLabel: "Expedicao",
    lane: "logistica",
    ownerTeam: "Expedicao e doca",
    slaHours: 5,
    nextStage: "faturamento",
  },
  {
    key: "faturamento",
    label: "Faturamento",
    shortLabel: "Faturamento",
    lane: "financeiro",
    ownerTeam: "Faturamento e fiscal",
    slaHours: 3,
    nextStage: "embarque",
  },
  {
    key: "embarque",
    label: "Embarque",
    shortLabel: "Embarque",
    lane: "logistica",
    ownerTeam: "Torre logistica",
    slaHours: 4,
  },
];

const stageDefinitionsByKey = Object.fromEntries(
  workflowStageDefinitions.map((definition) => [definition.key, definition]),
) as Record<WorkflowStageKey, StageDefinition>;

const customerNames = [
  "Magazine Aurora",
  "Grupo Varejo Sul",
  "Rede Perfil",
  "Atacado Horizonte",
  "Uniformes Prisma",
  "Loja Norte",
];

const carrierNames = [
  "Trans Vale",
  "Rota Sul Cargo",
  "Expresso Milenio",
  "Carga Prime",
];

const driverNames = [
  "Marcio Farias",
  "Paulo Nogueira",
  "Silvio Matos",
  "Julio Passos",
];

const truckPlates = ["RMA-1D42", "TXU-9H18", "JPL-7M63", "VRC-3K11"];
const dockNames = ["Doca 01", "Doca 02", "Doca 03", "Doca 05"];

export function enrichProductionSnapshotWithWorkflow(
  snapshot: WorkflowSourceSnapshot,
): ProductionSnapshot {
  const orderFlows = snapshot.orders.map((order, index) =>
    buildOrderProcessFlow(order, index, snapshot),
  );
  const processStages = workflowStageDefinitions.map((definition, index) =>
    buildStageOverview(definition, orderFlows, snapshot.alerts, index),
  );
  const shipmentManifests = orderFlows
    .filter((flow) => getStageIndex(flow.currentStage) >= getStageIndex("expedicao"))
    .map((flow, index) => buildShipmentManifest(flow, snapshot, index));

  return {
    ...snapshot,
    processStages,
    orderFlows,
    shipmentManifests,
  };
}

export function getWorkflowStageDefinitions() {
  return workflowStageDefinitions;
}

function buildOrderProcessFlow(
  order: ProductionOrder,
  index: number,
  snapshot: WorkflowSourceSnapshot,
): OrderProcessFlow {
  const overallCompletion = Math.min(
    100,
    Math.round((order.producedQuantity / Math.max(order.plannedQuantity, 1)) * 100),
  );
  const currentStage = resolveCurrentWorkflowStage(order, overallCompletion, snapshot.tick, index);
  const currentStageIndex = getStageIndex(currentStage);
  const customerName = order.customerName ?? customerNames[index % customerNames.length];
  const blockers = buildFlowBlockers(order, currentStage, snapshot.alerts);
  const routeHealth = resolveRouteHealth(order, blockers);
  const invoiceNumber =
    currentStageIndex >= getStageIndex("faturamento")
      ? `NF-${String(48000 + index * 13 + snapshot.tick).padStart(5, "0")}`
      : undefined;
  const manifestNumber =
    currentStageIndex >= getStageIndex("embarque") || currentStage === "expedicao"
      ? `MIN-${String(2200 + index * 7 + snapshot.tick).padStart(4, "0")}`
      : undefined;
  const truckPlate =
    currentStageIndex >= getStageIndex("embarque")
      ? truckPlates[index % truckPlates.length]
      : undefined;
  const loadingDock =
    currentStageIndex >= getStageIndex("expedicao")
      ? dockNames[index % dockNames.length]
      : undefined;
  const expectedDispatchAt = addMinutes(
    snapshot.currentTime,
    120 + index * 35 + (order.priority === "alta" ? -30 : 20),
  );

  const stages = workflowStageDefinitions.map((definition, stageIndex) =>
    buildOrderWorkflowStage({
      definition,
      stageIndex,
      currentStageIndex,
      currentStage,
      order,
      overallCompletion,
      routeHealth,
      blockers,
      timestamp: snapshot.currentTime,
      seed: snapshot.tick + index * 17,
    }),
  );

  return {
    orderId: order.id,
    orderNumber: order.number,
    productName: order.productName,
    customerName,
    priority: order.priority,
    plannedQuantity: order.plannedQuantity,
    deliveredQuantity: order.producedQuantity,
    dueDate: order.dueDate,
    currentStage,
    currentStageLabel: stageDefinitionsByKey[currentStage].label,
    overallCompletion,
    routeHealth,
    blockers,
    stages,
    invoiceNumber,
    manifestNumber,
    truckPlate,
    loadingDock,
    expectedDispatchAt,
  };
}

type BuildStageParams = {
  definition: StageDefinition;
  stageIndex: number;
  currentStageIndex: number;
  currentStage: WorkflowStageKey;
  order: ProductionOrder;
  overallCompletion: number;
  routeHealth: OrderProcessFlow["routeHealth"];
  blockers: string[];
  timestamp: string;
  seed: number;
};

function buildOrderWorkflowStage({
  definition,
  stageIndex,
  currentStageIndex,
  currentStage,
  order,
  overallCompletion,
  routeHealth,
  blockers,
  timestamp,
  seed,
}: BuildStageParams): OrderWorkflowStage {
  let status: WorkflowStageStatus = "aguardando";

  if (stageIndex < currentStageIndex) {
    status = "concluida";
  } else if (stageIndex === currentStageIndex) {
    status = blockers.length > 0 ? "bloqueada" : currentStage === "embarque" && order.status === "concluida" ? "pronta" : "em_andamento";
  }

  if (stageIndex === workflowStageDefinitions.length - 1 && order.status === "concluida" && seededRatio(seed) > 0.82) {
    status = "concluida";
  }

  const baseProgress = resolveStageProgress(stageIndex, currentStageIndex, overallCompletion, seededRatio(seed));
  const completedUnits = Math.round((baseProgress / 100) * order.plannedQuantity);
  const queueUnits = Math.max(order.plannedQuantity - completedUnits, 0);
  const leadTimeHours = Number(
    (definition.slaHours * (0.72 + seededRatio(seed + 3) * 0.58)).toFixed(1),
  );
  const note = buildStageNote(definition.key, status, order, routeHealth);
  const stageBlockers = stageIndex === currentStageIndex ? blockers : [];

  return {
    key: definition.key,
    label: definition.label,
    lane: definition.lane,
    status,
    progress: baseProgress,
    ownerTeam: definition.ownerTeam,
    leadTimeHours,
    slaHours: definition.slaHours,
    queueUnits,
    completedUnits,
    updatedAt: timestamp,
    note,
    blockers: stageBlockers,
    documents: buildStageDocuments(definition, status, order, timestamp, seed),
  };
}

function buildStageOverview(
  definition: StageDefinition,
  orderFlows: OrderProcessFlow[],
  alerts: ProductionAlert[],
  index: number,
): ProcessStageOverview {
  const stageRows = orderFlows.map((flow) => flow.stages[getStageIndex(definition.key)]);
  const activeRows = stageRows.filter(
    (stage) => stage.status === "em_andamento" || stage.status === "bloqueada" || stage.status === "pronta",
  );
  const queuedRows = stageRows.filter((stage) => stage.status === "aguardando");
  const pendingDocuments = stageRows.reduce(
    (total, stage) =>
      total + stage.documents.filter((document) => document.status === "pendente" || document.status === "em_revisao").length,
    0,
  );
  const alertCount =
    activeRows.filter((stage) => stage.status === "bloqueada").length +
    alerts.filter((alert) => matchesWorkflowAlert(definition.key, alert)).length;
  const efficiency = clampNumber(
    98 - pendingDocuments * 2.5 - alertCount * 4 - activeRows.filter((stage) => stage.status === "bloqueada").length * 6,
    58,
    99,
  );
  const leadTimeHours = Number(
    (
      (stageRows.reduce((total, stage) => total + stage.leadTimeHours, 0) / Math.max(stageRows.length, 1)) ||
      definition.slaHours
    ).toFixed(1),
  );
  const stageStatus: WorkflowStageStatus =
    activeRows.some((stage) => stage.status === "bloqueada")
      ? "bloqueada"
      : activeRows.some((stage) => stage.status === "pronta")
        ? "pronta"
        : activeRows.length > 0
          ? "em_andamento"
          : queuedRows.length === 0
            ? "concluida"
            : "aguardando";

  return {
    key: definition.key,
    label: definition.label,
    shortLabel: definition.shortLabel,
    lane: definition.lane,
    ownerTeam: definition.ownerTeam,
    status: stageStatus,
    activeOrders: activeRows.length,
    queuedOrders: queuedRows.length,
    backlogUnits: activeRows.reduce((total, stage) => total + stage.queueUnits, 0),
    completedUnits: stageRows.reduce((total, stage) => total + stage.completedUnits, 0),
    efficiency,
    leadTimeHours,
    slaHours: definition.slaHours,
    alertCount,
    pendingDocuments,
    bottleneckSummary: buildBottleneckSummary(definition.key, activeRows, pendingDocuments, index),
    nextStage: definition.nextStage,
  };
}

function buildShipmentManifest(
  flow: OrderProcessFlow,
  snapshot: WorkflowSourceSnapshot,
  index: number,
): ShipmentManifest {
  const currentStageIndex = getStageIndex(flow.currentStage);
  const status: ShipmentStatus =
    currentStageIndex < getStageIndex("faturamento")
      ? "aguardando_minuta"
      : currentStageIndex === getStageIndex("faturamento")
        ? "faturado"
        : getCurrentStageStatus(flow, "embarque") === "concluida"
          ? "despachado"
          : "em_carregamento";

  return {
    id: `ship-${flow.orderId}`,
    orderId: flow.orderId,
    orderNumber: flow.orderNumber,
    customerName: flow.customerName,
    invoiceNumber: flow.invoiceNumber,
    manifestNumber: flow.manifestNumber,
    truckPlate: flow.truckPlate,
    carrierName: carrierNames[index % carrierNames.length],
    driverName: driverNames[index % driverNames.length],
    dock: flow.loadingDock ?? dockNames[index % dockNames.length],
    status,
    expectedDepartureAt: flow.expectedDispatchAt ?? addMinutes(snapshot.currentTime, 180),
    updatedAt: snapshot.currentTime,
    packages: Math.max(12, Math.round(flow.plannedQuantity / 48)),
    weightKg: Math.max(180, Math.round(flow.plannedQuantity * (0.38 + seededRatio(index + snapshot.tick) * 0.22))),
  };
}

function buildStageDocuments(
  definition: StageDefinition,
  status: WorkflowStageStatus,
  order: ProductionOrder,
  timestamp: string,
  seed: number,
): WorkflowDocument[] {
  const templates = getDocumentTemplates(definition.key);

  return templates.map((template, index) => {
    const documentStatus = resolveDocumentStatus(status, seed + index);

    return {
      id: `${order.id}-${definition.key}-doc-${index + 1}`,
      label: template.label,
      owner: template.owner,
      status: documentStatus,
      reference:
        documentStatus === "liberado" || documentStatus === "emitido"
          ? `${template.prefix}-${String(1000 + seed + index).padStart(4, "0")}`
          : undefined,
      updatedAt: timestamp,
    };
  });
}

function getDocumentTemplates(stageKey: WorkflowStageKey) {
  if (stageKey === "desenho_tecnico") {
    return [
      { label: "Ficha tecnica", owner: "Engenharia", prefix: "FT" },
      { label: "Consumo e grade", owner: "PCP", prefix: "CG" },
      { label: "Aprovacao de amostra", owner: "Estilo", prefix: "AA" },
    ];
  }

  if (stageKey === "corte") {
    return [
      { label: "Plano de corte", owner: "Corte", prefix: "PC" },
      { label: "Mapa de risco", owner: "Modelagem", prefix: "MR" },
      { label: "OP liberada", owner: "PCP", prefix: "OP" },
    ];
  }

  if (stageKey === "estamparia") {
    return [
      { label: "Layout da estampa", owner: "Estamparia", prefix: "LE" },
      { label: "Setup de tela", owner: "Estamparia", prefix: "ST" },
      { label: "Lote de tinta", owner: "Suprimentos", prefix: "LT" },
    ];
  }

  if (stageKey === "qualidade") {
    return [
      { label: "Plano de inspecao", owner: "Qualidade", prefix: "PI" },
      { label: "Laudo AQL", owner: "Qualidade", prefix: "AQL" },
      { label: "Registro de retrabalho", owner: "Qualidade", prefix: "RR" },
    ];
  }

  if (stageKey === "expedicao") {
    return [
      { label: "Romaneio", owner: "Expedicao", prefix: "ROM" },
      { label: "Packing list", owner: "Expedicao", prefix: "PL" },
      { label: "Conferencia final", owner: "Doca", prefix: "CF" },
    ];
  }

  if (stageKey === "faturamento") {
    return [
      { label: "Nota fiscal", owner: "Fiscal", prefix: "NF" },
      { label: "Liberacao comercial", owner: "Financeiro", prefix: "LC" },
      { label: "Titulo faturado", owner: "Cobranca", prefix: "TF" },
    ];
  }

  return [
    { label: "Minuta", owner: "Logistica", prefix: "MIN" },
    { label: "Agenda de doca", owner: "Torre logistica", prefix: "DOC" },
    { label: "Motorista confirmado", owner: "Transportadora", prefix: "MOT" },
  ];
}

function resolveDocumentStatus(status: WorkflowStageStatus, seed: number): WorkflowDocumentStatus {
  if (status === "concluida") {
    return seededRatio(seed) > 0.35 ? "emitido" : "liberado";
  }

  if (status === "pronta") {
    return seededRatio(seed) > 0.2 ? "emitido" : "liberado";
  }

  if (status === "em_andamento") {
    return seededRatio(seed) > 0.65 ? "liberado" : "em_revisao";
  }

  if (status === "bloqueada") {
    return seededRatio(seed) > 0.5 ? "em_revisao" : "pendente";
  }

  return "pendente";
}

function resolveCurrentWorkflowStage(
  order: ProductionOrder,
  overallCompletion: number,
  tick: number,
  index: number,
): WorkflowStageKey {
  if (order.status === "concluida") {
    const postProductionRatio = seededRatio(tick + index * 5 + order.plannedQuantity);

    if (postProductionRatio > 0.82) {
      return "embarque";
    }

    if (postProductionRatio > 0.38) {
      return "faturamento";
    }

    return "expedicao";
  }

  if (order.currentSector === "corte" && overallCompletion < 20 && order.status === "parada") {
    return "desenho_tecnico";
  }

  if (overallCompletion < 22) {
    return "corte";
  }

  if (overallCompletion < 65) {
    return "estamparia";
  }

  if (overallCompletion < 90) {
    return "qualidade";
  }

  if (overallCompletion < 98) {
    return "expedicao";
  }

  return "faturamento";
}

function buildFlowBlockers(
  order: ProductionOrder,
  currentStage: WorkflowStageKey,
  alerts: ProductionAlert[],
) {
  const orderAlerts = alerts.filter((alert) => alert.orderNumber === order.number);

  if (currentStage === "desenho_tecnico") {
    return order.status === "parada"
      ? ["Ajuste de ficha tecnica e liberacao de aviamento pendentes."]
      : ["Revisao de consumo aguardando aprovacao comercial."];
  }

  if (currentStage === "qualidade" && order.defectRate >= 2) {
    return ["Lote com retrabalho acima da faixa nominal do turno."];
  }

  if (currentStage === "expedicao" && order.status === "atrasada") {
    return ["Conferencia final pressionando a janela de embarque."];
  }

  if (currentStage === "faturamento" && order.status !== "concluida") {
    return ["Separacao documental em paralelo com a ultima passagem da producao."];
  }

  return orderAlerts
    .filter((alert) => alert.severity === "high")
    .map((alert) => alert.description)
    .slice(0, 2);
}

function resolveRouteHealth(
  order: ProductionOrder,
  blockers: string[],
): OrderProcessFlow["routeHealth"] {
  if (order.status === "parada" || blockers.length > 0) {
    return "critical";
  }

  if (order.status === "atrasada" || order.defectRate >= 2) {
    return "warning";
  }

  return "on_track";
}

function resolveStageProgress(
  stageIndex: number,
  currentStageIndex: number,
  overallCompletion: number,
  variance: number,
) {
  if (stageIndex < currentStageIndex) {
    return 100;
  }

  if (stageIndex > currentStageIndex) {
    return clampNumber(variance * 8, 0, 8);
  }

  const ratio = overallCompletion / 100;
  const stageStart = stageIndex / workflowStageDefinitions.length;
  const stageEnd = (stageIndex + 1) / workflowStageDefinitions.length;
  const stageRatio = (ratio - stageStart) / Math.max(stageEnd - stageStart, 0.01);

  return clampNumber(stageRatio * 100, 8, 99);
}

function buildStageNote(
  stageKey: WorkflowStageKey,
  status: WorkflowStageStatus,
  order: ProductionOrder,
  routeHealth: OrderProcessFlow["routeHealth"],
) {
  const riskText =
    routeHealth === "critical"
      ? "Risco alto e necessidade de intervencao imediata."
      : routeHealth === "warning"
        ? "Monitoramento reforcado para manter a janela do pedido."
        : "Fluxo dentro da janela operacional planejada.";

  const notes: Record<WorkflowStageKey, string> = {
    desenho_tecnico: `Ficha do produto ${order.productName.toLowerCase()} consolidada para a proxima liberacao. ${riskText}`,
    corte: `Plano de corte sincronizado com a necessidade da OP ${order.number}. ${riskText}`,
    estamparia: `Fila de estampas e setup da linha alimentando a carteira da OP ${order.number}. ${riskText}`,
    qualidade: `Inspecao do lote e controle de retrabalho conectados ao throughput do turno. ${riskText}`,
    expedicao: `Separacao, packing list e romaneio sendo alinhados ao despacho do pedido. ${riskText}`,
    faturamento: `Financeiro e fiscal preparando documentos para liberar o faturamento. ${riskText}`,
    embarque: `Minuta, doca e caminhão coordenados para saida do pedido. ${riskText}`,
  };

  if (status === "concluida") {
    return `${notes[stageKey]} Etapa encerrada sem pendencias abertas.`;
  }

  if (status === "bloqueada") {
    return `${notes[stageKey]} Etapa com bloqueio operacional ou documental.`;
  }

  if (status === "pronta") {
    return `${notes[stageKey]} Etapa pronta para confirmacao final.`;
  }

  return notes[stageKey];
}

function buildBottleneckSummary(
  stageKey: WorkflowStageKey,
  activeRows: OrderWorkflowStage[],
  pendingDocuments: number,
  seed: number,
) {
  const blockedStage = activeRows.find((stage) => stage.status === "bloqueada");

  if (blockedStage) {
    return blockedStage.blockers[0] ?? "Bloqueio operacional exige priorizacao imediata.";
  }

  if (pendingDocuments > 0) {
    return `${pendingDocuments} documentos em revisao ou pendentes nesta etapa.`;
  }

  const defaults: Record<WorkflowStageKey, string> = {
    desenho_tecnico: "Revisoes de ficha e consumo monitoradas pelo PCP.",
    corte: "Balanceamento de risco e enfesto dentro da faixa nominal.",
    estamparia: "Setup da estampa e lote de tinta sincronizados com a fila.",
    qualidade: "Inspecoes por amostragem e retrabalho sob controle do lider.",
    expedicao: "Conferencia de volumes e romaneio sendo preparados pela doca.",
    faturamento: "Fila fiscal dentro da janela de emissao da nota.",
    embarque: seededRatio(seed) > 0.5 ? "Janela de carregamento confirmada com a transportadora." : "Aguardando encaixe de doca para o proximo despacho.",
  };

  return defaults[stageKey];
}

function matchesWorkflowAlert(stageKey: WorkflowStageKey, alert: ProductionAlert) {
  if (stageKey === "corte") {
    return alert.sector === "corte";
  }

  if (stageKey === "estamparia") {
    return alert.sector === "costura";
  }

  if (stageKey === "qualidade") {
    return alert.sector === "acabamento";
  }

  if (stageKey === "expedicao" || stageKey === "embarque") {
    return alert.sector === "expedicao";
  }

  return alert.sector === "fabrica";
}

function getCurrentStageStatus(flow: OrderProcessFlow, stageKey: WorkflowStageKey) {
  return flow.stages[getStageIndex(stageKey)]?.status;
}

function getStageIndex(stageKey: WorkflowStageKey) {
  return workflowStageDefinitions.findIndex((definition) => definition.key === stageKey);
}

function addMinutes(timestamp: string, minutes: number) {
  const date = new Date(timestamp);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function seededRatio(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}


import type {
  OrderProcessFlow,
  OrderWorkflowStage,
  ProcessStageOverview,
  ProductionAlert,
  ProductionManualEntry,
  ProductionOrder,
  ProductionSnapshot,
  ShipmentManifest,
  ShipmentStatus,
  WorkflowActionKey,
  WorkflowActionStatus,
  WorkflowAutomationState,
  WorkflowDocument,
  WorkflowDocumentStatus,
  WorkflowLane,
  WorkflowStageAction,
  WorkflowStageKey,
  WorkflowStageStatus,
  WorkflowTimelineEvent,
} from "./types";

type WorkflowSourceSnapshot = Omit<
  ProductionSnapshot,
  "processStages" | "orderFlows" | "shipmentManifests"
> &
  Partial<
    Pick<
      ProductionSnapshot,
      "processStages" | "orderFlows" | "shipmentManifests" | "workflowAutomation"
    >
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

type StageDraft = Omit<OrderWorkflowStage, "note">;

type StageBuildContext = {
  definition: StageDefinition;
  stageIndex: number;
  order: ProductionOrder;
  automation: WorkflowAutomationState;
  overallCompletion: number;
  currentStage: WorkflowStageKey;
  timestamp: string;
  tick: number;
  index: number;
  alerts: ProductionAlert[];
};

const workflowStageDefinitions: StageDefinition[] = [
  { key: "desenho_tecnico", label: "Desenho tecnico", shortLabel: "Desenho", lane: "engenharia", ownerTeam: "Engenharia do produto", slaHours: 8, nextStage: "corte" },
  { key: "corte", label: "Corte", shortLabel: "Corte", lane: "producao", ownerTeam: "Preparacao e corte", slaHours: 10, nextStage: "estamparia" },
  { key: "estamparia", label: "Estamparia", shortLabel: "Estampa", lane: "producao", ownerTeam: "Estamparia industrial", slaHours: 14, nextStage: "qualidade" },
  { key: "qualidade", label: "Qualidade", shortLabel: "Qualidade", lane: "qualidade", ownerTeam: "Controle de qualidade", slaHours: 6, nextStage: "expedicao" },
  { key: "expedicao", label: "Expedicao", shortLabel: "Expedicao", lane: "logistica", ownerTeam: "Expedicao e doca", slaHours: 5, nextStage: "faturamento" },
  { key: "faturamento", label: "Faturamento", shortLabel: "Faturamento", lane: "financeiro", ownerTeam: "Faturamento e fiscal", slaHours: 3, nextStage: "embarque" },
  { key: "embarque", label: "Embarque", shortLabel: "Embarque", lane: "logistica", ownerTeam: "Torre logistica", slaHours: 4 },
];

const workflowActionLabels: Record<WorkflowActionKey, string> = {
  aprovar_desenho: "Aprovar desenho",
  liberar_corte: "Liberar corte",
  liberar_estamparia: "Liberar estamparia",
  aprovar_qualidade: "Aprovar qualidade",
  conferir_expedicao: "Conferir expedicao",
  emitir_nf: "Emitir NF",
  gerar_minuta: "Gerar minuta",
  vincular_caminhao: "Vincular caminhao",
  confirmar_embarque: "Confirmar embarque",
};

const stageDefinitionsByKey = Object.fromEntries(
  workflowStageDefinitions.map((definition) => [definition.key, definition]),
) as Record<WorkflowStageKey, StageDefinition>;

const carrierNames = ["Trans Vale", "Rota Sul Cargo", "Expresso Milenio", "Carga Prime"];
const driverNames = ["Marcio Farias", "Paulo Nogueira", "Silvio Matos", "Julio Passos"];
const truckPlates = ["RMA-1D42", "TXU-9H18", "JPL-7M63", "VRC-3K11"];
const dockNames = ["Doca 01", "Doca 02", "Doca 03", "Doca 05"];

export function enrichProductionSnapshotWithWorkflow(
  snapshot: WorkflowSourceSnapshot,
): ProductionSnapshot {
  const workflowAutomation = snapshot.orders.map((order, index) =>
    hydrateWorkflowAutomation(
      order,
      snapshot.workflowAutomation?.find((item) => item.orderId === order.id),
      snapshot.currentTime,
      snapshot.tick,
      index,
    ),
  );
  const automationByOrderId = new Map(workflowAutomation.map((item) => [item.orderId, item]));
  const baseAlerts = snapshot.alerts ?? [];
  const baseFlows = snapshot.orders.map((order, index) =>
    buildOrderProcessFlow(order, index, snapshot, automationByOrderId.get(order.id)!, baseAlerts),
  );
  const workflowAlerts = buildWorkflowAlerts(baseFlows, snapshot.currentTime);
  const alerts = mergeWorkflowAlerts(baseAlerts, workflowAlerts);
  const orderFlows = snapshot.orders.map((order, index) =>
    buildOrderProcessFlow(order, index, snapshot, automationByOrderId.get(order.id)!, alerts),
  );
  const processStages = workflowStageDefinitions.map((definition, index) =>
    buildStageOverview(definition, orderFlows, alerts, index),
  );
  const shipmentManifests = orderFlows
    .filter((flow) => shouldDisplayManifest(flow))
    .map((flow, index) => buildShipmentManifest(flow, snapshot.currentTime, index));

  return {
    ...snapshot,
    alerts,
    workflowAutomation,
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
  automation: WorkflowAutomationState,
  alerts: ProductionAlert[],
): OrderProcessFlow {
  const overallCompletion = Math.min(
    100,
    Math.round((order.producedQuantity / Math.max(order.plannedQuantity, 1)) * 100),
  );
  const currentStage = resolveCurrentWorkflowStage(order, automation, overallCompletion);
  const stageDrafts = workflowStageDefinitions.map((definition, stageIndex) =>
    buildStageDraft({
      definition,
      stageIndex,
      order,
      automation,
      overallCompletion,
      currentStage,
      timestamp: snapshot.currentTime,
      tick: snapshot.tick,
      index,
      alerts,
    }),
  );
  const currentStageDraft = stageDrafts[getStageIndex(currentStage)];
  const blockers = currentStageDraft?.blockers ?? [];
  const routeHealth = resolveRouteHealth(order, blockers, currentStage, automation);
  const currentStageEnteredAt = estimateStageTimestamp(
    currentStage,
    automation,
    order,
    snapshot.currentTime,
  );
  const currentStageSlaHours =
    currentStageDraft?.slaHours ?? stageDefinitionsByKey[currentStage].slaHours;
  const currentStageAgingHours = calculateElapsedHours(
    currentStageEnteredAt,
    snapshot.currentTime,
  );
  const currentStageDelayHours = Number(
    Math.max(currentStageAgingHours - currentStageSlaHours, 0).toFixed(1),
  );
  const stages = stageDrafts.map((stage) => ({
    ...stage,
    note: buildStageNote(stage, order, routeHealth),
  }));
  const delayedStages = stages.filter((stage) => {
    if (stage.status === "aguardando" || stage.status === "concluida") {
      return false;
    }

    return (
      calculateElapsedHours(
        estimateStageTimestamp(stage.key, automation, order, snapshot.currentTime),
        snapshot.currentTime,
      ) > stage.slaHours
    );
  }).length;
  const totalLeadTimeHours = calculateElapsedHours(
    automation.createdAt,
    snapshot.currentTime,
  );
  const dominantBottleneck =
    blockers[0] ??
    (currentStageDelayHours > 0
      ? `${stageDefinitionsByKey[currentStage].label} acima do SLA em ${currentStageDelayHours.toFixed(1)}h.`
      : "Fluxo estabilizado dentro da janela operacional.");
  const timeline = buildOrderTimeline({
    order,
    automation,
    stages,
    alerts,
    history: snapshot.alertHistory ?? [],
    manualEntries: snapshot.manualEntries ?? [],
    currentTime: snapshot.currentTime,
    overallCompletion,
  });

  return {
    orderId: order.id,
    orderNumber: order.number,
    productName: order.productName,
    customerName: order.customerName ?? "Conta estrategica",
    priority: order.priority,
    plannedQuantity: order.plannedQuantity,
    deliveredQuantity: order.producedQuantity,
    dueDate: order.dueDate,
    currentStage,
    currentStageLabel: stageDefinitionsByKey[currentStage].label,
    currentStageEnteredAt,
    currentStageAgingHours,
    currentStageSlaHours,
    currentStageDelayHours,
    totalLeadTimeHours,
    delayedStages,
    dominantBottleneck,
    overallCompletion,
    routeHealth,
    blockers,
    stages,
    timeline,
    invoiceNumber: automation.invoiceNumber,
    manifestNumber: automation.manifestNumber,
    truckPlate: automation.truckPlate,
    loadingDock: automation.loadingDock,
    expectedDispatchAt: resolveExpectedDispatchAt(order, automation, snapshot.currentTime, index),
    carrierName: automation.carrierName,
    driverName: automation.driverName,
    dispatchedAt: automation.dispatchedAt,
    technicalSheetCode: automation.technicalSheetCode,
    technicalDrawingRevision: automation.technicalDrawingRevision,
    pilotSampleReference: automation.pilotSampleReference,
    technicalDrawingNote: automation.technicalDrawingNote,
    stampingInkLot: automation.stampingInkLot,
    stampingScreenCode: automation.stampingScreenCode,
    stampingArtworkCode: automation.stampingArtworkCode,
    qualityReportNumber: automation.qualityReportNumber,
    qualityAqlLevel: automation.qualityAqlLevel,
    qualityApprovedDefectRate: automation.qualityApprovedDefectRate,
    qualityApprovalNote: automation.qualityApprovalNote,
    expeditionPackages: automation.expeditionPackages,
    expeditionWeightKg: automation.expeditionWeightKg,
    expeditionCheckNote: automation.expeditionCheckNote,
    invoiceSeries: automation.invoiceSeries,
    fiscalOperationCode: automation.fiscalOperationCode,
    invoiceAccessKey: automation.invoiceAccessKey,
    invoiceNote: automation.invoiceNote,
    manifestRouteCode: automation.manifestRouteCode,
    manifestPickupWindowAt: automation.manifestPickupWindowAt,
    manifestNote: automation.manifestNote,
    truckSealCode: automation.truckSealCode,
    truckAssignmentNote: automation.truckAssignmentNote,
    dispatchNote: automation.dispatchNote,
  };
}

function buildStageDraft(context: StageBuildContext): StageDraft {
  const { definition, order, automation, overallCompletion, timestamp, alerts } = context;
  const progressRatio = overallCompletion / 100;
  const stageActions = buildStageActions(definition.key, order, automation, overallCompletion);
  const stageAlerts = getStageAlerts(order, definition.key, alerts);
  const externalBlockers = stageAlerts
    .filter((alert) => alert.severity === "high")
    .map((alert) => alert.description)
    .slice(0, 2);

  if (definition.key === "desenho_tecnico") {
    const actionPending = !automation.technicalDrawingApprovedAt;
    const blockers = actionPending
      ? ["Aguardando aprovacao final do desenho tecnico e da ficha do produto.", ...externalBlockers]
      : externalBlockers;

    return {
      key: definition.key,
      label: definition.label,
      lane: definition.lane,
      status: automation.technicalDrawingApprovedAt
        ? "concluida"
        : blockers.length > 1 || order.status === "parada"
          ? "bloqueada"
          : "pronta",
      progress: automation.technicalDrawingApprovedAt ? 100 : clampNumber(34 + progressRatio * 22, 18, 86),
      ownerTeam: definition.ownerTeam,
      leadTimeHours: resolveLeadTimeHours(definition, order, 0.82),
      slaHours: definition.slaHours,
      queueUnits: order.plannedQuantity,
      completedUnits: automation.technicalDrawingApprovedAt ? order.plannedQuantity : Math.round(order.plannedQuantity * 0.18),
      updatedAt: automation.technicalDrawingApprovedAt ?? automation.lastWorkflowUpdate,
      blockers,
      documents: buildStageDocuments(definition.key, order, automation, timestamp),
      actions: stageActions,
    };
  }

  if (definition.key === "corte") {
    const cutReleased = Boolean(automation.cuttingReleasedAt);
    const stageCompleted = overallCompletion >= 22;
    const blockers = !automation.technicalDrawingApprovedAt
      ? []
      : !cutReleased
        ? ["Liberacao do corte pendente no PCP para iniciar o enfesto.", ...externalBlockers]
        : order.status === "parada" && order.currentSector === "corte"
          ? ["Lote parado no corte aguardando liberacao de material ou ajuste de maquina.", ...externalBlockers]
          : externalBlockers;

    return {
      key: definition.key,
      label: definition.label,
      lane: definition.lane,
      status: !automation.technicalDrawingApprovedAt
        ? "aguardando"
        : stageCompleted
          ? "concluida"
          : !cutReleased
            ? blockers.length > 1
              ? "bloqueada"
              : "pronta"
            : order.currentSector === "corte"
              ? order.status === "parada"
                ? "bloqueada"
                : "em_andamento"
              : "concluida",
      progress: !automation.technicalDrawingApprovedAt
        ? 4
        : stageCompleted
          ? 100
          : cutReleased
            ? clampNumber((progressRatio / 0.22) * 100, 22, 96)
            : 68,
      ownerTeam: definition.ownerTeam,
      leadTimeHours: resolveLeadTimeHours(definition, order, 0.95),
      slaHours: definition.slaHours,
      queueUnits: Math.max(order.plannedQuantity - Math.round(order.plannedQuantity * Math.min(progressRatio / 0.22, 1)), 0),
      completedUnits: Math.round(order.plannedQuantity * Math.min(progressRatio / 0.22, 1)),
      updatedAt: automation.cuttingReleasedAt ?? automation.lastWorkflowUpdate,
      blockers,
      documents: buildStageDocuments(definition.key, order, automation, timestamp),
      actions: stageActions,
    };
  }

  if (definition.key === "estamparia") {
    const stageStarted = overallCompletion >= 22 || order.currentSector !== "corte";
    const stageCompleted = overallCompletion >= 65 || ["acabamento", "expedicao"].includes(order.currentSector);
    const blockers = !automation.cuttingReleasedAt
      ? externalBlockers
      : !automation.stampingReleasedAt
        ? ["Setup, layout e lote de tinta aguardando liberacao final da estamparia.", ...externalBlockers]
        : externalBlockers;

    return {
      key: definition.key,
      label: definition.label,
      lane: definition.lane,
      status: !automation.cuttingReleasedAt
        ? "aguardando"
        : stageCompleted
          ? "concluida"
          : !automation.stampingReleasedAt
            ? blockers.length > 1
              ? "bloqueada"
              : "pronta"
            : stageStarted
              ? "em_andamento"
              : "aguardando",
      progress: !automation.cuttingReleasedAt ? 4 : stageCompleted ? 100 : !automation.stampingReleasedAt ? 46 : clampNumber(((progressRatio - 0.22) / 0.43) * 100, 12, 94),
      ownerTeam: definition.ownerTeam,
      leadTimeHours: resolveLeadTimeHours(definition, order, 1.12),
      slaHours: definition.slaHours,
      queueUnits: Math.max(order.plannedQuantity - Math.round(order.plannedQuantity * clampNumber((progressRatio - 0.22) / 0.43, 0, 1)), 0),
      completedUnits: Math.round(order.plannedQuantity * clampNumber((progressRatio - 0.22) / 0.43, 0, 1)),
      updatedAt: automation.stampingReleasedAt ?? automation.lastWorkflowUpdate,
      blockers,
      documents: buildStageDocuments(definition.key, order, automation, timestamp),
      actions: stageActions,
    };
  }

  if (definition.key === "qualidade") {
    const stageReadyForApproval = overallCompletion >= 90 || order.currentSector === "expedicao" || order.status === "concluida";
    const blockers = !stageReadyForApproval
      ? externalBlockers
      : !automation.qualityApprovedAt
        ? [order.defectRate >= 2 ? "Laudo AQL retido por retrabalho acima da faixa nominal." : "Qualidade pronta para aprovacao final do lote.", ...externalBlockers]
        : externalBlockers;

    return {
      key: definition.key,
      label: definition.label,
      lane: definition.lane,
      status: overallCompletion < 65
        ? "aguardando"
        : automation.qualityApprovedAt
          ? "concluida"
          : stageReadyForApproval
            ? order.defectRate >= 2
              ? "bloqueada"
              : "pronta"
            : "em_andamento",
      progress: overallCompletion < 65 ? 4 : automation.qualityApprovedAt ? 100 : stageReadyForApproval ? 92 : clampNumber(((progressRatio - 0.65) / 0.25) * 100, 18, 88),
      ownerTeam: definition.ownerTeam,
      leadTimeHours: resolveLeadTimeHours(definition, order, 0.88),
      slaHours: definition.slaHours,
      queueUnits: Math.max(order.plannedQuantity - Math.round(order.plannedQuantity * clampNumber((progressRatio - 0.65) / 0.25, 0, 1)), 0),
      completedUnits: Math.round(order.plannedQuantity * clampNumber((progressRatio - 0.65) / 0.25, 0, 1)),
      updatedAt: automation.qualityApprovedAt ?? automation.lastWorkflowUpdate,
      blockers,
      documents: buildStageDocuments(definition.key, order, automation, timestamp),
      actions: stageActions,
    };
  }

  if (definition.key === "expedicao") {
    const stageStarted = overallCompletion >= 90 || order.currentSector === "expedicao" || order.status === "concluida";
    const blockers = !automation.qualityApprovedAt
      ? externalBlockers
      : !automation.expeditionCheckedAt
        ? ["Conferencia final, packing list e fechamento da expedicao aguardando validacao.", ...externalBlockers]
        : stageStarted && order.status === "atrasada"
          ? ["Expedicao trabalhando com janela apertada para cumprir o horario do pedido.", ...externalBlockers]
          : externalBlockers;

    return {
      key: definition.key,
      label: definition.label,
      lane: definition.lane,
      status: overallCompletion < 90
        ? "aguardando"
        : automation.expeditionCheckedAt
          ? "concluida"
          : order.status === "parada"
            ? "bloqueada"
            : order.status === "concluida"
              ? blockers.length > 1
                ? "bloqueada"
                : "pronta"
              : stageStarted
                ? "em_andamento"
                : "aguardando",
      progress: overallCompletion < 90 ? 4 : automation.expeditionCheckedAt ? 100 : order.status === "concluida" ? 88 : clampNumber(((progressRatio - 0.9) / 0.1) * 100, 24, 90),
      ownerTeam: definition.ownerTeam,
      leadTimeHours: resolveLeadTimeHours(definition, order, 0.78),
      slaHours: definition.slaHours,
      queueUnits: Math.max(order.plannedQuantity - order.producedQuantity, 0),
      completedUnits: order.producedQuantity,
      updatedAt: automation.expeditionCheckedAt ?? order.lastUpdate,
      blockers,
      documents: buildStageDocuments(definition.key, order, automation, timestamp),
      actions: stageActions,
    };
  }

  if (definition.key === "faturamento") {
    const ready = order.status === "concluida" && Boolean(automation.expeditionCheckedAt);
    const blockers = !ready
      ? externalBlockers
      : !automation.invoiceIssuedAt
        ? ["Nota fiscal aguardando emissao e validacao fiscal.", ...externalBlockers]
        : externalBlockers;

    return {
      key: definition.key,
      label: definition.label,
      lane: definition.lane,
      status: !ready ? "aguardando" : automation.invoiceIssuedAt ? "concluida" : blockers.length > 1 ? "bloqueada" : "pronta",
      progress: !ready ? 4 : automation.invoiceIssuedAt ? 100 : 88,
      ownerTeam: definition.ownerTeam,
      leadTimeHours: resolveLeadTimeHours(definition, order, 0.64),
      slaHours: definition.slaHours,
      queueUnits: ready && !automation.invoiceIssuedAt ? order.plannedQuantity : 0,
      completedUnits: automation.invoiceIssuedAt ? order.plannedQuantity : 0,
      updatedAt: automation.invoiceIssuedAt ?? automation.lastWorkflowUpdate,
      blockers,
      documents: buildStageDocuments(definition.key, order, automation, timestamp),
      actions: stageActions,
    };
  }

  const blockers = !automation.invoiceIssuedAt
    ? externalBlockers
    : !automation.manifestGeneratedAt
      ? ["Minuta de embarque ainda nao gerada para liberar a janela de doca.", ...externalBlockers]
      : !automation.truckAssignedAt
        ? ["Caminhao ainda nao vinculado para carregar o pedido na doca programada.", ...externalBlockers]
        : !automation.dispatchedAt
          ? isDispatchOverdue(resolveExpectedDispatchAt(order, automation, timestamp, context.index), timestamp)
            ? ["Janela de doca ultrapassada para o embarque desta OP.", ...externalBlockers]
            : ["Caminhao pronto para saida, aguardando confirmacao final de embarque.", ...externalBlockers]
          : externalBlockers;

  return {
    key: definition.key,
    label: definition.label,
    lane: definition.lane,
    status: !automation.invoiceIssuedAt ? "aguardando" : automation.dispatchedAt ? "concluida" : !automation.manifestGeneratedAt ? "pronta" : !automation.truckAssignedAt ? "bloqueada" : isDispatchOverdue(resolveExpectedDispatchAt(order, automation, timestamp, context.index), timestamp) ? "bloqueada" : "pronta",
    progress: !automation.invoiceIssuedAt ? 4 : automation.dispatchedAt ? 100 : !automation.manifestGeneratedAt ? 42 : !automation.truckAssignedAt ? 74 : 96,
    ownerTeam: definition.ownerTeam,
    leadTimeHours: resolveLeadTimeHours(definition, order, 0.71),
    slaHours: definition.slaHours,
    queueUnits: automation.dispatchedAt ? 0 : order.plannedQuantity,
    completedUnits: automation.dispatchedAt ? order.plannedQuantity : Math.round(order.plannedQuantity * 0.84),
    updatedAt: automation.truckAssignedAt ?? automation.manifestGeneratedAt ?? automation.invoiceIssuedAt ?? automation.lastWorkflowUpdate,
    blockers,
    documents: buildStageDocuments(definition.key, order, automation, timestamp),
    actions: stageActions,
  };
}

function buildStageOverview(
  definition: StageDefinition,
  orderFlows: OrderProcessFlow[],
  alerts: ProductionAlert[],
  index: number,
): ProcessStageOverview {
  const stageRows = orderFlows.map((flow) => flow.stages[getStageIndex(definition.key)]);
  const activeRows = stageRows.filter((stage) => stage.status === "em_andamento" || stage.status === "bloqueada" || stage.status === "pronta");
  const queuedRows = stageRows.filter((stage) => stage.status === "aguardando");
  const pendingDocuments = stageRows.reduce(
    (total, stage) => total + stage.documents.filter((document) => document.status === "pendente" || document.status === "em_revisao").length,
    0,
  );
  const alertCount = alerts.filter((alert) => matchesWorkflowAlert(definition.key, alert)).length;
  const efficiency = clampNumber(98 - pendingDocuments * 2.8 - alertCount * 4 - activeRows.filter((stage) => stage.status === "bloqueada").length * 6, 58, 99);
  const leadTimeHours = Number((((stageRows.reduce((total, stage) => total + stage.leadTimeHours, 0) / Math.max(stageRows.length, 1)) || definition.slaHours)).toFixed(1));
  const stageStatus: WorkflowStageStatus = activeRows.some((stage) => stage.status === "bloqueada")
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

function buildShipmentManifest(flow: OrderProcessFlow, currentTime: string, index: number): ShipmentManifest {
  const status: ShipmentStatus = !flow.invoiceNumber
    ? "pronto_para_faturar"
    : flow.dispatchedAt
      ? "despachado"
      : flow.manifestNumber && flow.truckPlate
        ? "em_carregamento"
        : flow.manifestNumber
          ? "faturado"
          : "aguardando_minuta";

  return {
    id: `ship-${flow.orderId}`,
    orderId: flow.orderId,
    orderNumber: flow.orderNumber,
    customerName: flow.customerName,
    invoiceNumber: flow.invoiceNumber,
    manifestNumber: flow.manifestNumber,
    truckPlate: flow.truckPlate,
    carrierName: flow.carrierName ?? carrierNames[index % carrierNames.length],
    driverName: flow.driverName ?? driverNames[index % driverNames.length],
    dock: flow.loadingDock ?? dockNames[index % dockNames.length],
    status,
    expectedDepartureAt:
      flow.manifestPickupWindowAt ?? flow.expectedDispatchAt ?? addMinutes(currentTime, 180),
    updatedAt: currentTime,
    packages: flow.expeditionPackages ?? Math.max(12, Math.round(flow.plannedQuantity / 48)),
    weightKg: flow.expeditionWeightKg ?? Math.max(180, Math.round(flow.plannedQuantity * 0.43)),
  };
}

function buildStageDocuments(
  stageKey: WorkflowStageKey,
  order: ProductionOrder,
  automation: WorkflowAutomationState,
  timestamp: string,
): WorkflowDocument[] {
  const makeDocument = (
    idSuffix: string,
    label: string,
    owner: string,
    status: WorkflowDocumentStatus,
    reference?: string,
    summary?: string,
    highlights?: string[],
  ): WorkflowDocument => ({
    id: `${order.id}-${stageKey}-${idSuffix}`,
    label,
    owner,
    status,
    reference,
    summary,
    highlights: highlights?.filter(Boolean),
    updatedAt: timestamp,
  });

  if (stageKey === "desenho_tecnico") {
    return [
      makeDocument(
        "ft",
        "Ficha tecnica",
        "Engenharia",
        automation.technicalDrawingApprovedAt ? "emitido" : "em_revisao",
        automation.technicalDrawingApprovedAt ? automation.technicalSheetCode : undefined,
        automation.technicalDrawingApprovedAt
          ? `Ficha liberada para ${order.productName.toLowerCase()} com revisao ${automation.technicalDrawingRevision ?? "em validacao"}.`
          : "Engenharia consolidando parametros, grade e ficha do produto.",
        compactHighlights([
          automation.technicalDrawingRevision
            ? `Revisao ${automation.technicalDrawingRevision}`
            : undefined,
          automation.pilotSampleReference
            ? `Piloto ${automation.pilotSampleReference}`
            : undefined,
          automation.technicalDrawingNote,
        ]),
      ),
      makeDocument(
        "cg",
        "Consumo e grade",
        "PCP",
        automation.technicalDrawingApprovedAt ? "liberado" : "em_revisao",
        automation.technicalDrawingApprovedAt
          ? `CG-${order.number.slice(-2)}-${order.id.slice(-2)}`
          : undefined,
        automation.technicalDrawingApprovedAt
          ? "Grade, encaixe e consumo aprovados para liberar o corte."
          : "PCP revisando grade e consumo antes da liberacao do enfesto.",
        compactHighlights([
          `${order.plannedQuantity} pecas planejadas`,
          `${order.line} como linha principal`,
        ]),
      ),
      makeDocument(
        "aa",
        "Aprovacao de amostra",
        "Estilo",
        automation.technicalDrawingApprovedAt ? "emitido" : "pendente",
        automation.pilotSampleReference,
        automation.technicalDrawingApprovedAt
          ? "Piloto aprovado e congelado para seguir ao corte."
          : "Aguardando aprovacao final do piloto e do acabamento visual.",
        compactHighlights([
          automation.pilotSampleReference
            ? `Piloto ${automation.pilotSampleReference}`
            : undefined,
        ]),
      ),
    ];
  }

  if (stageKey === "corte") {
    return [
      makeDocument(
        "pc",
        "Plano de corte",
        "Corte",
        automation.cuttingReleasedAt
          ? "emitido"
          : automation.technicalDrawingApprovedAt
            ? "em_revisao"
            : "pendente",
        automation.cuttingReleasedAt
          ? `PC-${order.number.slice(-2)}-${order.id.slice(-2)}`
          : undefined,
        automation.cuttingReleasedAt
          ? "Plano de corte liberado com enfesto alinhado ao lote."
          : "Equipe de corte revisando encaixe, enfesto e apontamento inicial.",
        compactHighlights([
          order.number,
          `${order.plannedQuantity} pecas`,
          automation.cuttingReleasedBy ? `Liberado por ${automation.cuttingReleasedBy}` : undefined,
        ]),
      ),
      makeDocument(
        "mr",
        "Mapa de risco",
        "Modelagem",
        automation.technicalDrawingApprovedAt ? "liberado" : "pendente",
        undefined,
        automation.technicalDrawingApprovedAt
          ? "Riscos de modelagem e encaixe mapeados para o lote."
          : "Mapa de risco aguarda dados finais da engenharia.",
        compactHighlights([
          `${order.productName} / ${order.line}`,
        ]),
      ),
      makeDocument(
        "op",
        "OP liberada",
        "PCP",
        automation.cuttingReleasedAt ? "emitido" : "pendente",
        automation.cuttingReleasedAt ? order.number : undefined,
        automation.cuttingReleasedAt
          ? "OP formalmente liberada para a producao industrial."
          : "PCP ainda nao liberou a ordem para a operacao.",
        compactHighlights([
          order.number,
          order.priority === "alta" ? "Prioridade alta" : undefined,
        ]),
      ),
    ];
  }

  if (stageKey === "estamparia") {
    return [
      makeDocument(
        "le",
        "Layout da estampa",
        "Estamparia",
        automation.stampingReleasedAt
          ? "emitido"
          : automation.cuttingReleasedAt
            ? "liberado"
            : "pendente",
        automation.stampingArtworkCode,
        automation.stampingReleasedAt
          ? "Arte e layout aprovados para rodar na estamparia."
          : "Layout aguardando liberacao operacional da estamparia.",
        compactHighlights([
          automation.stampingArtworkCode
            ? `Arte ${automation.stampingArtworkCode}`
            : undefined,
          automation.stampingReleaseNote,
        ]),
      ),
      makeDocument(
        "st",
        "Setup de tela",
        "Estamparia",
        automation.stampingReleasedAt
          ? "emitido"
          : automation.cuttingReleasedAt
            ? "em_revisao"
            : "pendente",
        automation.stampingScreenCode,
        automation.stampingReleasedAt
          ? "Tela e setup estabilizados para a passagem do lote."
          : "Preparacao de tela e setup ainda em validacao.",
        compactHighlights([
          automation.stampingScreenCode
            ? `Tela ${automation.stampingScreenCode}`
            : undefined,
        ]),
      ),
      makeDocument(
        "lt",
        "Lote de tinta",
        "Suprimentos",
        automation.stampingReleasedAt
          ? "emitido"
          : automation.cuttingReleasedAt
            ? "liberado"
            : "pendente",
        automation.stampingInkLot,
        automation.stampingReleasedAt
          ? "Lote de tinta validado e associado ao pedido."
          : "Suprimentos ainda nao consolidaram o lote de tinta.",
        compactHighlights([
          automation.stampingInkLot
            ? `Tinta ${automation.stampingInkLot}`
            : undefined,
        ]),
      ),
    ];
  }

  if (stageKey === "qualidade") {
    return [
      makeDocument(
        "pi",
        "Plano de inspecao",
        "Qualidade",
        order.producedQuantity / order.plannedQuantity >= 0.72
          ? "emitido"
          : "em_revisao",
        order.producedQuantity / order.plannedQuantity >= 0.72
          ? `PI-${order.number.slice(-2)}-${order.id.slice(-2)}`
          : undefined,
        "Plano de amostragem e verificacoes dimensionais do lote.",
        compactHighlights([
          `${Math.round((order.producedQuantity / order.plannedQuantity) * 100)}% do lote produzido`,
          automation.qualityAqlLevel ? `AQL ${automation.qualityAqlLevel}` : undefined,
        ]),
      ),
      makeDocument(
        "aql",
        "Laudo AQL",
        "Qualidade",
        automation.qualityApprovedAt
          ? "emitido"
          : order.defectRate >= 2
            ? "em_revisao"
            : "pendente",
        automation.qualityReportNumber,
        automation.qualityApprovedAt
          ? `Laudo ${automation.qualityReportNumber ?? "AQL"} aprovado e liberado para expedicao.`
          : "Laudo AQL ainda em revisao antes da liberacao do lote.",
        compactHighlights([
          automation.qualityAqlLevel ? `Nivel ${automation.qualityAqlLevel}` : undefined,
          automation.qualityApprovedDefectRate !== undefined
            ? `${automation.qualityApprovedDefectRate}% defeito aprovado`
            : undefined,
          automation.qualityApprovalNote,
        ]),
      ),
      makeDocument(
        "rr",
        "Registro de retrabalho",
        "Qualidade",
        order.defectRate >= 2
          ? "emitido"
          : automation.qualityApprovedAt
            ? "liberado"
            : "pendente",
        order.defectRate >= 2
          ? `RR-${order.number.slice(-2)}-${order.id.slice(-2)}`
          : undefined,
        order.defectRate >= 2
          ? "Retrabalho aberto para conter desvio acima da faixa nominal."
          : "Sem necessidade de retrabalho adicional nesta etapa.",
        compactHighlights([
          `${order.defectRate}% defeito atual`,
          automation.qualityReopenReason,
        ]),
      ),
    ];
  }

  if (stageKey === "expedicao") {
    return [
      makeDocument(
        "rom",
        "Romaneio",
        "Expedicao",
        automation.expeditionCheckedAt
          ? "emitido"
          : order.currentSector === "expedicao" || order.status === "concluida"
            ? "em_revisao"
            : "pendente",
        automation.expeditionCheckedAt
          ? `ROM-${order.number.slice(-2)}-${order.id.slice(-2)}`
          : undefined,
        automation.expeditionCheckedAt
          ? "Romaneio conferido e pronto para faturamento."
          : "Expedicao montando romaneio e separacao final.",
        compactHighlights([
          automation.expeditionPackages
            ? `${automation.expeditionPackages} volumes`
            : undefined,
        ]),
      ),
      makeDocument(
        "pl",
        "Packing list",
        "Expedicao",
        automation.expeditionCheckedAt
          ? "emitido"
          : order.currentSector === "expedicao" || order.status === "concluida"
            ? "em_revisao"
            : "pendente",
        automation.expeditionCheckedAt
          ? `PL-${order.number.slice(-2)}-${order.id.slice(-2)}`
          : undefined,
        automation.expeditionCheckedAt
          ? "Packing list consolidado com volumes e peso total."
          : "Packing list aguardando conferencia final de volumes.",
        compactHighlights([
          automation.expeditionWeightKg
            ? `${automation.expeditionWeightKg} kg`
            : undefined,
          automation.expeditionCheckNote,
        ]),
      ),
      makeDocument(
        "cf",
        "Conferencia final",
        "Doca",
        automation.expeditionCheckedAt
          ? "emitido"
          : order.status === "concluida"
            ? "liberado"
            : "pendente",
        automation.expeditionCheckedAt
          ? `CF-${order.number.slice(-2)}-${order.id.slice(-2)}`
          : undefined,
        automation.expeditionCheckedAt
          ? "Conferencia final concluida para liberar a nota fiscal."
          : "Doca ainda nao fechou a conferencia do lote.",
        compactHighlights([
          automation.expeditionCheckedBy
            ? `Conferente ${automation.expeditionCheckedBy}`
            : undefined,
        ]),
      ),
    ];
  }

  if (stageKey === "faturamento") {
    return [
      makeDocument(
        "nf",
        "Nota fiscal",
        "Fiscal",
        automation.invoiceIssuedAt ? "emitido" : "pendente",
        automation.invoiceNumber,
        automation.invoiceIssuedAt
          ? "Documento fiscal emitido e pronto para embarque."
          : "Faturamento ainda nao concluiu a emissao da NF.",
        compactHighlights([
          automation.invoiceSeries
            ? `Serie ${automation.invoiceSeries}`
            : undefined,
          automation.fiscalOperationCode
            ? `CFOP ${automation.fiscalOperationCode}`
            : undefined,
          automation.invoiceAccessKey
            ? `Chave ${automation.invoiceAccessKey.slice(-8)}`
            : undefined,
        ]),
      ),
      makeDocument(
        "lc",
        "Liberacao comercial",
        "Financeiro",
        order.status === "concluida" ? "liberado" : "pendente",
        undefined,
        order.status === "concluida"
          ? "Financeiro liberado para faturar o pedido concluido."
          : "Aguardando conclusao da expedicao para liberar faturamento.",
        compactHighlights([order.customerName ?? "Conta estrategica"]),
      ),
      makeDocument(
        "tf",
        "Titulo faturado",
        "Cobranca",
        automation.invoiceIssuedAt ? "emitido" : "pendente",
        automation.invoiceIssuedAt
          ? `TF-${order.number.slice(-2)}-${order.id.slice(-2)}`
          : undefined,
        automation.invoiceIssuedAt
          ? "Titulo gerado para fechamento financeiro da remessa."
          : "Titulo aguarda a emissao da nota fiscal.",
        compactHighlights([automation.invoiceNote]),
      ),
    ];
  }

  return [
    makeDocument(
      "min",
      "Minuta",
      "Logistica",
      automation.manifestGeneratedAt ? "emitido" : "pendente",
      automation.manifestNumber,
      automation.manifestGeneratedAt
        ? "Minuta emitida com rota e janela de coleta definidas."
        : "Logistica ainda nao consolidou a minuta do embarque.",
      compactHighlights([
        automation.manifestRouteCode
          ? `Rota ${automation.manifestRouteCode}`
          : undefined,
        automation.manifestPickupWindowAt
          ? `Janela ${formatWorkflowTimestamp(automation.manifestPickupWindowAt)}`
          : undefined,
      ]),
    ),
    makeDocument(
      "doc",
      "Agenda de doca",
      "Torre logistica",
      automation.loadingDock
        ? "liberado"
        : automation.manifestGeneratedAt
          ? "em_revisao"
          : "pendente",
      automation.loadingDock,
      automation.loadingDock
        ? "Doca reservada para carregamento do pedido."
        : "Janela de doca ainda em definicao.",
      compactHighlights([
        automation.loadingDock ? `Doca ${automation.loadingDock}` : undefined,
        automation.dockScheduledAt
          ? formatWorkflowTimestamp(automation.dockScheduledAt)
          : undefined,
      ]),
    ),
    makeDocument(
      "mot",
      "Motorista confirmado",
      "Transportadora",
      automation.truckAssignedAt ? "emitido" : "pendente",
      automation.truckPlate,
      automation.truckAssignedAt
        ? "Veiculo e motorista confirmados para o embarque."
        : "Transportadora ainda nao confirmou caminhao e motorista.",
      compactHighlights([
        automation.carrierName,
        automation.driverName,
        automation.truckSealCode ? `Lacre ${automation.truckSealCode}` : undefined,
      ]),
    ),
  ];
}

function buildStageActions(
  stageKey: WorkflowStageKey,
  order: ProductionOrder,
  automation: WorkflowAutomationState,
  overallCompletion: number,
): WorkflowStageAction[] {
  const actions: WorkflowStageAction[] = [];

  if (stageKey === "desenho_tecnico") {
    actions.push(createStageAction("aprovar_desenho", "Concluir ficha tecnica, grade e amostra para liberar o pedido ao corte.", resolveActionStatus({ completedAt: automation.technicalDrawingApprovedAt, ready: true }), automation.technicalDrawingApprovedAt, automation.technicalDrawingApprovedBy, buildActionDetailSummary("aprovar_desenho", automation)));
  }

  if (stageKey === "corte") {
    actions.push(createStageAction("liberar_corte", "Liberar OP, plano de corte e enfesto para iniciar a producao do lote.", resolveActionStatus({ completedAt: automation.cuttingReleasedAt, ready: Boolean(automation.technicalDrawingApprovedAt) }), automation.cuttingReleasedAt, automation.cuttingReleasedBy, buildActionDetailSummary("liberar_corte", automation)));
  }

  if (stageKey === "estamparia") {
    actions.push(createStageAction("liberar_estamparia", "Liberar layout, setup e lote de tinta para estabilizar a estamparia antes da passagem ao acabamento.", resolveActionStatus({ completedAt: automation.stampingReleasedAt, ready: Boolean(automation.cuttingReleasedAt) }), automation.stampingReleasedAt, automation.stampingReleasedBy, buildActionDetailSummary("liberar_estamparia", automation)));
  }

  if (stageKey === "qualidade") {
    actions.push(createStageAction("aprovar_qualidade", "Fechar o AQL e liberar o lote para expedicao e faturamento.", resolveActionStatus({ completedAt: automation.qualityApprovedAt, ready: overallCompletion >= 90 || order.currentSector === "expedicao" || order.status === "concluida" }), automation.qualityApprovedAt, automation.qualityApprovedBy, buildActionDetailSummary("aprovar_qualidade", automation)));
  }

  if (stageKey === "expedicao") {
    actions.push(createStageAction("conferir_expedicao", "Conferir volumes, romaneio e packing list para destravar o faturamento da OP.", resolveActionStatus({ completedAt: automation.expeditionCheckedAt, ready: order.status === "concluida" && Boolean(automation.qualityApprovedAt) }), automation.expeditionCheckedAt, automation.expeditionCheckedBy, buildActionDetailSummary("conferir_expedicao", automation)));
  }

  if (stageKey === "faturamento") {
    actions.push(createStageAction("emitir_nf", "Emitir a nota fiscal e destravar a transferencia do pedido para o embarque.", resolveActionStatus({ completedAt: automation.invoiceIssuedAt, ready: order.status === "concluida" && Boolean(automation.expeditionCheckedAt) }), automation.invoiceIssuedAt, automation.invoiceIssuedBy, buildActionDetailSummary("emitir_nf", automation)));
  }

  if (stageKey === "embarque") {
    actions.push(createStageAction("gerar_minuta", "Gerar a minuta de embarque e consolidar a agenda de doca.", resolveActionStatus({ completedAt: automation.manifestGeneratedAt, ready: Boolean(automation.invoiceIssuedAt) }), automation.manifestGeneratedAt, automation.manifestGeneratedBy, buildActionDetailSummary("gerar_minuta", automation)));
    actions.push(createStageAction("vincular_caminhao", "Vincular doca, transportadora, motorista e placa do caminhao.", resolveActionStatus({ completedAt: automation.truckAssignedAt, ready: Boolean(automation.manifestGeneratedAt) }), automation.truckAssignedAt, automation.truckAssignedBy, buildActionDetailSummary("vincular_caminhao", automation)));
    actions.push(createStageAction("confirmar_embarque", "Confirmar a saida do pedido na doca e registrar a liberacao final para o caminhao.", resolveActionStatus({ completedAt: automation.dispatchedAt, ready: Boolean(automation.truckAssignedAt) }), automation.dispatchedAt, automation.dispatchedBy, buildActionDetailSummary("confirmar_embarque", automation)));
  }

  return actions;
}

function createStageAction(
  key: WorkflowActionKey,
  description: string,
  status: WorkflowActionStatus,
  completedAt?: string,
  completedBy?: string,
  detailSummary?: string,
): WorkflowStageAction {
  return {
    key,
    label: workflowActionLabels[key],
    description,
    status,
    completedAt,
    completedBy,
    detailSummary,
  };
}

function buildActionDetailSummary(
  key: WorkflowActionKey,
  automation: WorkflowAutomationState,
) {
  if (key === "aprovar_desenho") {
    const details = [
      automation.technicalSheetCode ? `Ficha ${automation.technicalSheetCode}` : undefined,
      automation.technicalDrawingRevision ? `Rev ${automation.technicalDrawingRevision}` : undefined,
      automation.pilotSampleReference ? `Piloto ${automation.pilotSampleReference}` : undefined,
    ].filter(Boolean);

    return details.join(" | ");
  }

  if (key === "liberar_estamparia") {
    const details = [
      automation.stampingArtworkCode ? `Arte ${automation.stampingArtworkCode}` : undefined,
      automation.stampingScreenCode ? `Tela ${automation.stampingScreenCode}` : undefined,
      automation.stampingInkLot ? `Tinta ${automation.stampingInkLot}` : undefined,
    ].filter(Boolean);

    return details.join(" | ");
  }

  if (key === "conferir_expedicao") {
    const details = [
      automation.expeditionPackages ? `${automation.expeditionPackages} volumes` : undefined,
      automation.expeditionWeightKg ? `${automation.expeditionWeightKg} kg` : undefined,
      automation.expeditionCheckNote,
    ].filter(Boolean);

    return details.join(" | ");
  }

  if (key === "aprovar_qualidade") {
    const details = [
      automation.qualityReportNumber ? `Laudo ${automation.qualityReportNumber}` : undefined,
      automation.qualityAqlLevel ? `AQL ${automation.qualityAqlLevel}` : undefined,
      automation.qualityApprovedDefectRate !== undefined
        ? `Defeito ${automation.qualityApprovedDefectRate}%`
        : undefined,
    ].filter(Boolean);

    return details.join(" | ");
  }

  if (key === "emitir_nf") {
    const details = [
      automation.invoiceNumber,
      automation.invoiceSeries ? `Serie ${automation.invoiceSeries}` : undefined,
      automation.fiscalOperationCode ? `CFOP ${automation.fiscalOperationCode}` : undefined,
    ].filter(Boolean);

    return details.join(" | ");
  }

  if (key === "gerar_minuta") {
    const details = [
      automation.manifestNumber,
      automation.manifestRouteCode ? `Rota ${automation.manifestRouteCode}` : undefined,
      automation.manifestPickupWindowAt
        ? `Janela ${formatWorkflowTimestamp(automation.manifestPickupWindowAt)}`
        : undefined,
    ].filter(Boolean);

    return details.join(" | ");
  }

  if (key === "confirmar_embarque") {
    const details = [
      automation.loadingDock ? `Doca ${automation.loadingDock}` : undefined,
      automation.dispatchNote,
    ].filter(Boolean);

    return details.join(" | ");
  }

  if (key === "vincular_caminhao") {
    const details = [
      automation.truckPlate ? `Placa ${automation.truckPlate}` : undefined,
      automation.carrierName,
      automation.truckSealCode ? `Lacre ${automation.truckSealCode}` : undefined,
    ].filter(Boolean);

    return details.join(" | ");
  }

  return undefined;
}

function resolveActionStatus({ completedAt, ready }: { completedAt?: string; ready: boolean }): WorkflowActionStatus {
  if (completedAt) {
    return "concluido";
  }

  return ready ? "pronto" : "pendente";
}

function buildOrderTimeline({
  order,
  automation,
  stages,
  alerts,
  history,
  manualEntries,
  currentTime,
  overallCompletion,
}: {
  order: ProductionOrder;
  automation: WorkflowAutomationState;
  stages: OrderWorkflowStage[];
  alerts: ProductionAlert[];
  history: ProductionAlert[];
  manualEntries: ProductionManualEntry[];
  currentTime: string;
  overallCompletion: number;
}): WorkflowTimelineEvent[] {
  const events: WorkflowTimelineEvent[] = [
    {
      id: `${order.id}-created`,
      timestamp: automation.createdAt,
      stageKey: "desenho_tecnico",
      stageLabel: stageDefinitionsByKey.desenho_tecnico.label,
      type: "stage_started",
      title: "Pedido aberto na engenharia",
      description: `A OP ${order.number} entrou no fluxo ponta a ponta para ${order.productName.toLowerCase()}.`,
      tone: "info",
      actor: "Sistema",
    },
  ];

  stages.filter((stage) => stage.status !== "aguardando").forEach((stage) => {
    events.push({
      id: `${order.id}-${stage.key}-started`,
      timestamp: estimateStageTimestamp(stage.key, automation, order, currentTime),
      stageKey: stage.key,
      stageLabel: stage.label,
      type: "stage_started",
      title: `${stage.label} em acompanhamento`,
      description: stage.note,
      tone: stage.status === "concluida" ? "success" : stage.status === "bloqueada" ? "danger" : stage.status === "pronta" ? "warning" : "info",
    });

    stage.actions.filter((action) => action.completedAt).forEach((action) => {
      events.push({
        id: `${order.id}-${action.key}`,
        timestamp: action.completedAt!,
        stageKey: stage.key,
        stageLabel: stage.label,
        type: "action_completed",
        title: action.label,
        description: action.detailSummary
          ? `${action.label} registrada para liberar a etapa ${stage.label.toLowerCase()}. ${action.detailSummary}.`
          : `${action.label} registrada para liberar a etapa ${stage.label.toLowerCase()}.`,
        tone: "success",
        actor: action.completedBy,
      });
    });
  });

  if (order.status === "concluida") {
    events.push({
      id: `${order.id}-expedicao-finalizada`,
      timestamp: order.lastUpdate,
      stageKey: "expedicao",
      stageLabel: stageDefinitionsByKey.expedicao.label,
      type: "document_ready",
      title: "Lote concluido na expedicao",
      description: `A OP ${order.number} fechou a conferencia final com ${order.plannedQuantity} pecas produzidas.`,
      tone: "success",
      actor: "Sistema",
    });
  }

  if (automation.truckAssignedAt) {
    events.push({
      id: `${order.id}-dispatch-scheduled`,
      timestamp: automation.truckAssignedAt,
      stageKey: "embarque",
      stageLabel: stageDefinitionsByKey.embarque.label,
      type: "dispatch_scheduled",
      title: "Janela de embarque agendada",
      description: `${automation.loadingDock ?? "Doca pendente"} reservada com ${automation.carrierName ?? "transportadora"} para o caminhao ${automation.truckPlate ?? "a definir"}.`,
      tone: "info",
      actor: automation.truckAssignedBy,
    });
  }

  if (automation.dispatchedAt) {
    events.push({
      id: `${order.id}-dispatch-completed`,
      timestamp: automation.dispatchedAt,
      stageKey: "embarque",
      stageLabel: stageDefinitionsByKey.embarque.label,
      type: "dispatch_completed",
      title: "Pedido liberado para o caminhao",
      description: `Despacho concluido com ${automation.truckPlate ?? "caminhao vinculado"} e minuta ${automation.manifestNumber ?? "emitida"}${automation.dispatchNote ? `. Observacao: ${automation.dispatchNote}` : ""}.`,
      tone: "success",
      actor: automation.dispatchedBy ?? "Logistica",
    });
  }

  if (automation.qualityReopenedAt) {
    events.push({
      id: `${order.id}-quality-reopened`,
      timestamp: automation.qualityReopenedAt,
      stageKey: "qualidade",
      stageLabel: stageDefinitionsByKey.qualidade.label,
      type: "action_completed",
      title: "Qualidade reaberta",
      description: automation.qualityReopenReason
        ? `Lote devolvido para nova avaliacao. Motivo: ${automation.qualityReopenReason}.`
        : "Lote devolvido para nova avaliacao de qualidade.",
      tone: "warning",
      actor: automation.qualityReopenedBy ?? "Qualidade",
    });
  }

  if (automation.invoiceCorrectedAt) {
    events.push({
      id: `${order.id}-invoice-corrected`,
      timestamp: automation.invoiceCorrectedAt,
      stageKey: "faturamento",
      stageLabel: stageDefinitionsByKey.faturamento.label,
      type: "action_completed",
      title: "Dados fiscais corrigidos",
      description: [
        automation.invoiceSeries ? `Serie ${automation.invoiceSeries}` : undefined,
        automation.fiscalOperationCode
          ? `CFOP ${automation.fiscalOperationCode}`
          : undefined,
        automation.invoiceCorrectionNote,
      ]
        .filter(Boolean)
        .join(" | "),
      tone: "warning",
      actor: automation.invoiceCorrectedBy ?? "Faturamento",
    });
  }

  if (automation.dockRescheduledAt) {
    events.push({
      id: `${order.id}-dock-rescheduled`,
      timestamp: automation.dockRescheduledAt,
      stageKey: "embarque",
      stageLabel: stageDefinitionsByKey.embarque.label,
      type: "dispatch_scheduled",
      title: "Doca remarcada",
      description: [
        automation.loadingDock ? `Nova doca ${automation.loadingDock}` : undefined,
        automation.dockScheduledAt
          ? `Janela ${formatWorkflowTimestamp(automation.dockScheduledAt)}`
          : undefined,
        automation.dockRescheduleNote,
      ]
        .filter(Boolean)
        .join(" | "),
      tone: "warning",
      actor: automation.dockRescheduledBy ?? "Logistica",
    });
  }

  if (automation.truckReassignedAt) {
    events.push({
      id: `${order.id}-truck-reassigned`,
      timestamp: automation.truckReassignedAt,
      stageKey: "embarque",
      stageLabel: stageDefinitionsByKey.embarque.label,
      type: "dispatch_scheduled",
      title: "Caminhao substituido",
      description: [
        automation.truckPlate ? `Placa ${automation.truckPlate}` : undefined,
        automation.carrierName,
        automation.truckReassignmentNote,
      ]
        .filter(Boolean)
        .join(" | "),
      tone: "info",
      actor: automation.truckReassignedBy ?? "Torre logistica",
    });
  }

  manualEntries.filter((entry) => entry.orderId === order.id).forEach((entry) => {
    const stageKey = mapSectorToWorkflowStage(entry.sector, overallCompletion);
    events.push({
      id: `${order.id}-${entry.id}`,
      timestamp: entry.timestamp,
      stageKey,
      stageLabel: stageDefinitionsByKey[stageKey].label,
      type: "manual_entry",
      title: `Apontamento manual: ${entry.action.replaceAll("_", " ")}`,
      description: entry.note ?? entry.reason ?? `${entry.operatorName} registrou um evento operacional na OP.`,
      tone: entry.action === "registrar_parada" ? "danger" : entry.action === "registrar_defeito" ? "warning" : "info",
      actor: entry.operatorName,
    });
  });

  [...alerts, ...history]
    .filter((alert) => alert.orderId === order.id || alert.orderNumber === order.number)
    .slice(0, 6)
    .forEach((alert) => {
      const stageKey = alert.workflowStage ?? mapAlertToWorkflowStage(alert, order, overallCompletion);
      events.push({
        id: `${order.id}-alert-${alert.id}`,
        timestamp: alert.resolvedAt ?? alert.acknowledgedAt ?? alert.timestamp,
        stageKey,
        stageLabel: stageDefinitionsByKey[stageKey].label,
        type: "alert_triggered",
        title: alert.title,
        description: alert.description,
        tone: alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "info",
        actor: alert.acknowledgedBy,
      });
    });

  return events
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .filter((event, index, collection) => collection.findIndex((item) => item.id === event.id) === index)
    .slice(0, 20);
}

function buildWorkflowAlerts(orderFlows: OrderProcessFlow[], currentTime: string): ProductionAlert[] {
  const now = new Date(currentTime).getTime();

  return orderFlows.flatMap((flow) => {
    const currentStage = flow.stages[getStageIndex(flow.currentStage)];
    const pendingDocuments = currentStage.documents.filter((document) => document.status === "pendente" || document.status === "em_revisao");
    const alerts: ProductionAlert[] = [];

    if (pendingDocuments.length > 0) {
      alerts.push({
        id: `flow-doc-${flow.orderId}`,
        fingerprint: `flow-doc-${flow.orderNumber.toLowerCase()}-${flow.currentStage}`,
        type: "documento_pendente",
        title: `${flow.orderNumber} com documentacao pendente em ${flow.currentStageLabel.toLowerCase()}`,
        description: `${pendingDocuments.length} documentos aguardam revisao ou emissao para liberar a etapa atual.`,
        severity: flow.priority === "alta" || currentStage.status === "bloqueada" ? "high" : "medium",
        sector: getStageAlertSector(flow.currentStage),
        workflowStage: flow.currentStage,
        orderId: flow.orderId,
        orderNumber: flow.orderNumber,
        timestamp: currentTime,
        active: true,
        source: "simulation",
      });
    }

    if (flow.currentStageDelayHours > 0) {
      alerts.push({
        id: `flow-sla-${flow.orderId}`,
        fingerprint: `flow-sla-${flow.orderNumber.toLowerCase()}-${flow.currentStage}`,
        type: "sla_estourado",
        title: `${flow.orderNumber} acima do SLA em ${flow.currentStageLabel.toLowerCase()}`,
        description: `${flow.currentStageDelayHours.toFixed(1)}h acima da janela prevista de ${flow.currentStageSlaHours}h para a etapa atual.`,
        severity:
          flow.currentStageDelayHours >= 2 || flow.priority === "alta"
            ? "high"
            : "medium",
        sector: getStageAlertSector(flow.currentStage),
        workflowStage: flow.currentStage,
        orderId: flow.orderId,
        orderNumber: flow.orderNumber,
        timestamp: currentTime,
        active: true,
        source: "simulation",
      });
    }

    if (flow.currentStage === "faturamento" && !flow.invoiceNumber) {
      alerts.push({
        id: `flow-nf-${flow.orderId}`,
        fingerprint: `flow-nf-${flow.orderNumber.toLowerCase()}`,
        type: "nf_travada",
        title: `${flow.orderNumber} aguardando nota fiscal`,
        description: "Faturamento pendente bloqueia a transferencia do pedido para o embarque.",
        severity: flow.priority === "alta" ? "high" : "medium",
        sector: "fabrica",
        workflowStage: "faturamento",
        orderId: flow.orderId,
        orderNumber: flow.orderNumber,
        timestamp: currentTime,
        active: true,
        source: "simulation",
      });
    }

    if ((flow.currentStage === "expedicao" || flow.currentStage === "embarque") && flow.expectedDispatchAt && !flow.dispatchedAt && new Date(flow.expectedDispatchAt).getTime() <= now) {
      alerts.push({
        id: `flow-dock-${flow.orderId}`,
        fingerprint: `flow-dock-${flow.orderNumber.toLowerCase()}`,
        type: "doca_atrasada",
        title: `${flow.orderNumber} com doca atrasada`,
        description: `A janela prevista de embarque venceu em ${formatIsoForAlert(flow.expectedDispatchAt)} e exige replanejamento logistico.`,
        severity: "high",
        sector: "expedicao",
        workflowStage: flow.currentStage,
        orderId: flow.orderId,
        orderNumber: flow.orderNumber,
        timestamp: currentTime,
        active: true,
        source: "simulation",
      });
    }

    if (flow.currentStage === "embarque" && flow.manifestNumber && !flow.truckPlate) {
      alerts.push({
        id: `flow-truck-${flow.orderId}`,
        fingerprint: `flow-truck-${flow.orderNumber.toLowerCase()}`,
        type: "caminhao_nao_vinculado",
        title: `${flow.orderNumber} sem caminhao vinculado`,
        description: "Minuta emitida, mas o caminhao ainda nao foi associado a transportadora, motorista e doca.",
        severity: "high",
        sector: "expedicao",
        workflowStage: "embarque",
        orderId: flow.orderId,
        orderNumber: flow.orderNumber,
        timestamp: currentTime,
        active: true,
        source: "simulation",
      });
    }

    return alerts;
  });
}

function mergeWorkflowAlerts(baseAlerts: ProductionAlert[], workflowAlerts: ProductionAlert[]) {
  const operationalAlerts = baseAlerts.filter((alert) => !alert.fingerprint.startsWith("flow-"));
  return [...operationalAlerts, ...workflowAlerts].sort(compareAlertsByPriority);
}

function compareAlertsByPriority(left: ProductionAlert, right: ProductionAlert) {
  const severityRank = { high: 0, medium: 1, info: 2 } as const;
  const bySeverity = severityRank[left.severity] - severityRank[right.severity];

  if (bySeverity !== 0) {
    return bySeverity;
  }

  return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
}

function hydrateWorkflowAutomation(
  order: ProductionOrder,
  existing: WorkflowAutomationState | undefined,
  currentTime: string,
  tick: number,
  index: number,
): WorkflowAutomationState {
  const createdAt = existing?.createdAt ?? addMinutes(order.dueDate, -1 * (1440 + index * 75));
  const progress = order.producedQuantity / Math.max(order.plannedQuantity, 1);
  const next: WorkflowAutomationState = {
    orderId: order.id,
    createdAt,
    lastWorkflowUpdate: currentTime,
    ...existing,
  };

  if (!next.technicalDrawingApprovedAt && (progress >= 0.12 || tick >= 2 + index * 2)) {
    next.technicalDrawingApprovedAt = addMinutes(createdAt, 90 + index * 12);
    next.technicalDrawingApprovedBy = next.technicalDrawingApprovedBy ?? "Engenharia do produto";
  }

  if (next.technicalDrawingApprovedAt) {
    next.technicalSheetCode = next.technicalSheetCode ?? buildTechnicalSheetCode(index);
    next.technicalDrawingRevision =
      next.technicalDrawingRevision ?? `R${2 + (index % 3)}`;
    next.pilotSampleReference =
      next.pilotSampleReference ?? buildPilotSampleReference(index);
  }

  if (order.status === "parada" && order.currentSector === "corte" && progress < 0.2) {
    next.technicalDrawingApprovedAt = existing?.technicalDrawingApprovedAt;
    next.technicalDrawingApprovedBy = existing?.technicalDrawingApprovedBy;
  }

  if (!next.cuttingReleasedAt && next.technicalDrawingApprovedAt && (progress >= 0.24 || order.currentSector !== "corte")) {
    next.cuttingReleasedAt = addMinutes(next.technicalDrawingApprovedAt, 70 + index * 9);
    next.cuttingReleasedBy = next.cuttingReleasedBy ?? "PCP";
  }

  if (!next.stampingReleasedAt && next.cuttingReleasedAt && (progress >= 0.38 || order.currentSector === "acabamento" || order.currentSector === "expedicao" || order.status === "concluida")) {
    next.stampingReleasedAt = addMinutes(next.cuttingReleasedAt, 95 + index * 11);
    next.stampingReleasedBy = next.stampingReleasedBy ?? "Estamparia industrial";
  }

  if (next.stampingReleasedAt) {
    next.stampingArtworkCode =
      next.stampingArtworkCode ?? buildArtworkCode(order, index);
    next.stampingScreenCode =
      next.stampingScreenCode ?? `TL-${String(8 + index).padStart(2, "0")}`;
    next.stampingInkLot =
      next.stampingInkLot ?? `LT-${String(new Date(currentTime).getFullYear()).slice(-2)}A-${118 + index}`;
  }

  if (
    !next.qualityApprovedAt &&
    !next.qualityReopenedAt &&
    (progress >= 0.92 || order.status === "concluida") &&
    order.defectRate < 2.05
  ) {
    next.qualityApprovedAt = addMinutes(order.lastUpdate, -40);
    next.qualityApprovedBy = next.qualityApprovedBy ?? "Controle de qualidade";
  }

  if (next.qualityApprovedAt) {
    next.qualityReportNumber =
      next.qualityReportNumber ?? buildQualityReportNumber(index);
    next.qualityAqlLevel = next.qualityAqlLevel ?? "NII";
    next.qualityApprovedDefectRate =
      next.qualityApprovedDefectRate ?? Number(Math.max(order.defectRate, 0.4).toFixed(2));
  }

  if (!next.expeditionCheckedAt && order.status === "concluida" && Boolean(next.qualityApprovedAt)) {
    next.expeditionCheckedAt = addMinutes(order.lastUpdate, 12 + index * 3);
    next.expeditionCheckedBy = next.expeditionCheckedBy ?? "Expedicao e doca";
  }

  if (next.expeditionCheckedAt) {
    next.expeditionPackages =
      next.expeditionPackages ?? Math.max(12, Math.round(order.plannedQuantity / 48));
    next.expeditionWeightKg =
      next.expeditionWeightKg ?? Math.max(180, Math.round(order.plannedQuantity * 0.43));
  }

  if (!next.invoiceIssuedAt && order.status === "concluida" && next.expeditionCheckedAt) {
    next.invoiceIssuedAt = addMinutes(order.lastUpdate, 28 + index * 6);
    next.invoiceIssuedBy = next.invoiceIssuedBy ?? "Faturamento";
    next.invoiceNumber = next.invoiceNumber ?? buildInvoiceNumber(index);
  }

  if (next.invoiceIssuedAt) {
    next.invoiceSeries = next.invoiceSeries ?? "1";
    next.fiscalOperationCode = next.fiscalOperationCode ?? "5.102";
    next.invoiceAccessKey =
      next.invoiceAccessKey ??
      buildInvoiceAccessKey(next.invoiceNumber ?? buildInvoiceNumber(index), next.invoiceSeries, index);
  }

  if (!next.manifestGeneratedAt && next.invoiceIssuedAt) {
    next.manifestGeneratedAt = addMinutes(next.invoiceIssuedAt, 22 + index * 4);
    next.manifestGeneratedBy = next.manifestGeneratedBy ?? "Logistica";
    next.manifestNumber = next.manifestNumber ?? buildManifestNumber(index);
  }

  if (next.manifestGeneratedAt) {
    next.manifestRouteCode = next.manifestRouteCode ?? buildManifestRouteCode(index);
    next.manifestPickupWindowAt =
      next.manifestPickupWindowAt ?? addMinutes(next.manifestGeneratedAt, 18);
  }

  if (!next.loadingDock && next.manifestGeneratedAt) {
    next.loadingDock = dockNames[index % dockNames.length];
    next.dockScheduledAt =
      next.dockScheduledAt ?? next.manifestPickupWindowAt ?? addMinutes(next.manifestGeneratedAt, 12);
  }

  if (!next.truckAssignedAt && next.manifestGeneratedAt) {
    next.truckAssignedAt = addMinutes(next.manifestGeneratedAt, 18 + index * 4);
    next.truckAssignedBy = next.truckAssignedBy ?? "Torre logistica";
    next.truckPlate = next.truckPlate ?? truckPlates[index % truckPlates.length];
    next.carrierName = next.carrierName ?? carrierNames[index % carrierNames.length];
    next.driverName = next.driverName ?? driverNames[index % driverNames.length];
  }

  if (next.truckAssignedAt) {
    next.truckSealCode = next.truckSealCode ?? buildTruckSealCode(index);
  }

  if (
    !next.dispatchedAt &&
    next.truckAssignedAt &&
    !next.dockRescheduledAt &&
    !next.truckReassignedAt &&
    order.status === "concluida"
  ) {
    next.dispatchedAt = addMinutes(next.truckAssignedAt, 35 + index * 5);
    next.dispatchedBy = next.dispatchedBy ?? "Torre logistica";
  }

  return next;
}

function resolveCurrentWorkflowStage(
  order: ProductionOrder,
  automation: WorkflowAutomationState,
  overallCompletion: number,
): WorkflowStageKey {
  if (!automation.technicalDrawingApprovedAt) {
    return "desenho_tecnico";
  }

  if (!automation.cuttingReleasedAt || overallCompletion < 22) {
    return "corte";
  }

  if (!automation.stampingReleasedAt || overallCompletion < 65) {
    return "estamparia";
  }

  if (!automation.qualityApprovedAt || overallCompletion < 90) {
    return "qualidade";
  }

  if (!automation.expeditionCheckedAt || order.status !== "concluida" || overallCompletion < 98) {
    return "expedicao";
  }

  if (!automation.invoiceIssuedAt) {
    return "faturamento";
  }

  return "embarque";
}

function buildStageNote(stage: StageDraft, order: ProductionOrder, routeHealth: OrderProcessFlow["routeHealth"]) {
  const riskText = routeHealth === "critical"
    ? "Risco alto e necessidade de intervencao imediata."
    : routeHealth === "warning"
      ? "Monitoramento reforcado para manter a janela do pedido."
      : "Fluxo dentro da janela operacional planejada.";
  const actionSummary = stage.actions.filter((action) => action.status === "pronto").map((action) => `${action.label.toLowerCase()} pendente`).join("; ");
  const baseNotes: Record<WorkflowStageKey, string> = {
    desenho_tecnico: `Ficha do produto ${order.productName.toLowerCase()} consolidada para a proxima liberacao.`,
    corte: `Plano de corte sincronizado com a necessidade da OP ${order.number}.`,
    estamparia: `Fila de estampas e setup da linha alimentando a carteira da OP ${order.number}.`,
    qualidade: `Inspecao do lote e controle de retrabalho conectados ao throughput do turno.`,
    expedicao: `Separacao, packing list e romaneio sendo alinhados ao despacho do pedido.`,
    faturamento: `Financeiro e fiscal preparando documentos para liberar o faturamento.`,
    embarque: `Minuta, doca e caminhao coordenados para saida do pedido.`,
  };
  const blockerText = stage.blockers[0] ? ` ${stage.blockers[0]}` : "";
  const actionText = actionSummary ? ` Acao solicitada: ${actionSummary}.` : "";

  if (stage.status === "concluida") {
    return `${baseNotes[stage.key]} ${riskText} Etapa encerrada sem pendencias abertas.`;
  }

  return `${baseNotes[stage.key]} ${riskText}${actionText}${blockerText}`.trim();
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
    embarque:
      seed % 2 === 0
        ? "Janela de carregamento confirmada com a transportadora."
        : "Aguardando encaixe de doca para o proximo despacho.",
  };

  return defaults[stageKey];
}

function resolveRouteHealth(
  order: ProductionOrder,
  blockers: string[],
  currentStage: WorkflowStageKey,
  automation: WorkflowAutomationState,
): OrderProcessFlow["routeHealth"] {
  if (order.status === "parada" || blockers.length > 0 || (currentStage === "embarque" && (!automation.manifestGeneratedAt || !automation.truckAssignedAt))) {
    return "critical";
  }

  if (order.status === "atrasada" || order.defectRate >= 2) {
    return "warning";
  }

  return "on_track";
}

function matchesWorkflowAlert(stageKey: WorkflowStageKey, alert: ProductionAlert) {
  if (alert.workflowStage) {
    return alert.workflowStage === stageKey;
  }

  return getStageAlertSector(stageKey) === alert.sector;
}

function getStageAlerts(order: ProductionOrder, stageKey: WorkflowStageKey, alerts: ProductionAlert[]) {
  return alerts.filter((alert) => {
    if (alert.orderId && alert.orderId !== order.id) {
      return false;
    }

    if (alert.orderNumber && alert.orderNumber !== order.number) {
      return false;
    }

    if (alert.workflowStage) {
      return alert.workflowStage === stageKey;
    }

    return getStageAlertSector(stageKey) === alert.sector;
  });
}

function resolveLeadTimeHours(definition: StageDefinition, order: ProductionOrder, multiplier: number) {
  const priorityFactor = order.priority === "alta" ? 0.92 : order.priority === "media" ? 1.03 : 1.08;
  return Number((definition.slaHours * multiplier * priorityFactor).toFixed(1));
}

function shouldDisplayManifest(flow: OrderProcessFlow) {
  return getStageIndex(flow.currentStage) >= getStageIndex("expedicao") || Boolean(flow.invoiceNumber || flow.manifestNumber || flow.truckPlate);
}

function getStageIndex(stageKey: WorkflowStageKey) {
  return workflowStageDefinitions.findIndex((definition) => definition.key === stageKey);
}

function getStageAlertSector(stageKey: WorkflowStageKey) {
  if (stageKey === "corte") {
    return "corte" as const;
  }

  if (stageKey === "estamparia") {
    return "costura" as const;
  }

  if (stageKey === "qualidade") {
    return "acabamento" as const;
  }

  if (stageKey === "expedicao" || stageKey === "embarque") {
    return "expedicao" as const;
  }

  return "fabrica" as const;
}

function mapSectorToWorkflowStage(sector: ProductionOrder["currentSector"], overallCompletion: number): WorkflowStageKey {
  if (sector === "corte") {
    return overallCompletion < 18 ? "desenho_tecnico" : "corte";
  }

  if (sector === "costura") {
    return "estamparia";
  }

  if (sector === "acabamento") {
    return "qualidade";
  }

  return overallCompletion >= 98 ? "embarque" : "expedicao";
}

function mapAlertToWorkflowStage(alert: ProductionAlert, order: ProductionOrder, overallCompletion: number): WorkflowStageKey {
  if (alert.workflowStage) {
    return alert.workflowStage;
  }

  if (alert.sector === "corte") {
    return overallCompletion < 18 ? "desenho_tecnico" : "corte";
  }

  if (alert.sector === "costura") {
    return "estamparia";
  }

  if (alert.sector === "acabamento") {
    return "qualidade";
  }

  if (alert.sector === "expedicao") {
    return order.status === "concluida" ? "embarque" : "expedicao";
  }

  return order.status === "concluida" && overallCompletion >= 98 ? "faturamento" : "desenho_tecnico";
}

function estimateStageTimestamp(stageKey: WorkflowStageKey, automation: WorkflowAutomationState, order: ProductionOrder, currentTime: string) {
  if (stageKey === "desenho_tecnico") {
    return automation.createdAt;
  }

  if (stageKey === "corte") {
    return automation.technicalDrawingApprovedAt ?? addMinutes(automation.createdAt, 120);
  }

  if (stageKey === "estamparia") {
    return automation.cuttingReleasedAt ?? addMinutes(automation.createdAt, 260);
  }

  if (stageKey === "qualidade") {
    return automation.stampingReleasedAt ?? addMinutes(order.lastUpdate, -180);
  }

  if (stageKey === "expedicao") {
    return automation.qualityApprovedAt ?? addMinutes(order.lastUpdate, -60);
  }

  if (stageKey === "faturamento") {
    return automation.expeditionCheckedAt ?? addMinutes(order.lastUpdate, 25);
  }

  return automation.invoiceIssuedAt ?? automation.manifestGeneratedAt ?? addMinutes(currentTime, -35);
}

function resolveExpectedDispatchAt(order: ProductionOrder, automation: WorkflowAutomationState, currentTime: string, index: number) {
  return automation.dockScheduledAt ?? automation.truckAssignedAt ?? addMinutes(order.status === "concluida" ? order.lastUpdate : currentTime, 110 + index * 18);
}

function isDispatchOverdue(expectedDispatchAt: string | undefined, referenceTime: string) {
  if (!expectedDispatchAt) {
    return false;
  }

  return new Date(expectedDispatchAt).getTime() <= new Date(referenceTime).getTime();
}

function formatIsoForAlert(timestamp: string) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function buildInvoiceNumber(index: number) {
  return `NF-${String(48000 + index * 13).padStart(5, "0")}`;
}

function buildManifestNumber(index: number) {
  return `MIN-${String(2200 + index * 7).padStart(4, "0")}`;
}

function buildTechnicalSheetCode(index: number) {
  return `FT-${new Date().getFullYear()}-${String(140 + index).padStart(4, "0")}`;
}

function buildPilotSampleReference(index: number) {
  return `PIL-${String(70 + index).padStart(3, "0")}`;
}

function buildArtworkCode(order: ProductionOrder, index: number) {
  return `ART-${order.number.slice(-2)}${String(index).padStart(2, "0")}`;
}

function buildQualityReportNumber(index: number) {
  return `LQ-${String(900 + index * 5).padStart(4, "0")}`;
}

function buildManifestRouteCode(index: number) {
  return `RT-${["NE", "SE", "CO", "SU"][index % 4]}-${String(index + 3).padStart(2, "0")}`;
}

function buildTruckSealCode(index: number) {
  return `LC-${String(920 + index * 4).padStart(4, "0")}`;
}

function buildInvoiceAccessKey(invoiceNumber: string, invoiceSeries: string, index: number) {
  const nfDigits = invoiceNumber.replace(/\D/g, "").padStart(9, "0");
  const seriesDigits = invoiceSeries.replace(/\D/g, "").padStart(3, "0");
  return `${nfDigits}35260312345678000155${seriesDigits}${String(index).padStart(2, "0")}`;
}

function formatWorkflowTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(timestamp));
}

function addMinutes(timestamp: string, minutes: number) {
  const date = new Date(timestamp);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function calculateElapsedHours(startAt: string | undefined, endAt: string) {
  if (!startAt) {
    return 0;
  }

  const diffMs = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Number(Math.max(diffMs / 3_600_000, 0).toFixed(1));
}

function compactHighlights(values: Array<string | undefined>) {
  return values.filter(Boolean).slice(0, 3) as string[];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}


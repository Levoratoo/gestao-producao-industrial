import { sectorSequence } from "./mock-data";
import type {
  FinalizeStagePayload,
  HourlyProductionPoint,
  ProductionAlert,
  ProductionManualEntry,
  ProductionOrder,
  ProductionSector,
  ProductionSnapshot,
  RegisterDowntimePayload,
  RegisterQualityPayload,
  ReportProductionPayload,
  SectorKey,
  StartOrderPayload,
} from "./types";
import { enrichProductionSnapshotWithWorkflow } from "./workflow";

const manualEntriesLimit = 18;
const alertLimit = 10;

export function applyManualStartOrder(
  snapshot: ProductionSnapshot,
  payload: StartOrderPayload,
) {
  const order = snapshot.orders.find((item) => item.id === payload.orderId);
  const operator = snapshot.operators.find(
    (item) => item.id === payload.operatorId,
  );

  if (!order || !operator || order.status === "concluida") {
    return snapshot;
  }

  const timestamp = buildManualTimestamp(snapshot);

  const nextOrders = snapshot.orders.map<ProductionOrder>((item) =>
    item.id === order.id
      ? {
          ...item,
          status: "em_andamento",
          lastUpdate: timestamp,
        }
      : item,
  );

  const nextSectors = snapshot.sectors.map<ProductionSector>((sector) =>
    sector.key === order.currentSector
      ? {
          ...sector,
          status: "operando",
          efficiency: clampNumber(sector.efficiency + 3, 60, 99),
          machinesRunning: clampInteger(
            Math.max(sector.machinesRunning, 1),
            0,
            sector.machinesTotal,
          ),
        }
      : sector,
  );

  const nextManualEntries = prependManualEntry(snapshot.manualEntries, {
    id: `manual-${snapshot.tick}-${snapshot.manualEntries.length + 1}`,
    timestamp,
    action: "iniciar_op",
    orderId: order.id,
    orderNumber: order.number,
    productName: order.productName,
    sector: order.currentSector,
    operatorId: operator.id,
    operatorName: operator.name,
    note: payload.note?.trim() || "OP retomada manualmente pela lideranca.",
  });

  return recalculateSnapshot({
    ...snapshot,
    orders: nextOrders,
    sectors: nextSectors,
    alerts: removeOrderAlerts(snapshot.alerts, order.number),
    manualEntries: nextManualEntries,
  });
}

export function applyManualProductionReport(
  snapshot: ProductionSnapshot,
  payload: ReportProductionPayload,
) {
  const order = snapshot.orders.find((item) => item.id === payload.orderId);
  const operator = snapshot.operators.find(
    (item) => item.id === payload.operatorId,
  );
  const sanitizedQuantity = clampInteger(Math.round(payload.quantity), 0, 99999);

  if (!order || !operator || order.status === "concluida" || sanitizedQuantity <= 0) {
    return snapshot;
  }

  const timestamp = buildManualTimestamp(snapshot);
  const actualIncrement = Math.min(
    sanitizedQuantity,
    Math.max(order.plannedQuantity - order.producedQuantity, 0),
  );

  if (actualIncrement <= 0) {
    return snapshot;
  }

  const nextProducedQuantity = order.producedQuantity + actualIncrement;
  const shouldConclude =
    order.currentSector === "expedicao" &&
    nextProducedQuantity >= order.plannedQuantity;

  const nextOrders = snapshot.orders.map<ProductionOrder>((item) =>
    item.id === order.id
      ? {
          ...item,
          producedQuantity: nextProducedQuantity,
          status: shouldConclude ? "concluida" : "em_andamento",
          lastUpdate: timestamp,
        }
      : item,
  );

  const nextSectors = snapshot.sectors.map<ProductionSector>((sector) =>
    sector.key === order.currentSector
      ? {
          ...sector,
          actualDailyOutput: sector.actualDailyOutput + actualIncrement,
          efficiency: clampNumber(sector.efficiency + 1, 60, 99),
          status: "operando",
        }
      : sector,
  );

  const nextManualEntries = prependManualEntry(snapshot.manualEntries, {
    id: `manual-${snapshot.tick}-${snapshot.manualEntries.length + 1}`,
    timestamp,
    action: "apontar_producao",
    orderId: order.id,
    orderNumber: order.number,
    productName: order.productName,
    sector: order.currentSector,
    operatorId: operator.id,
    operatorName: operator.name,
    quantity: actualIncrement,
    note: payload.note?.trim() || "Producao registrada manualmente no turno.",
  });

  const nextDailyProduced =
    order.currentSector === "expedicao"
      ? snapshot.dailyProduced + actualIncrement
      : snapshot.dailyProduced;

  return recalculateSnapshot({
    ...snapshot,
    dailyProduced: nextDailyProduced,
    orders: nextOrders,
    sectors: nextSectors,
    alerts: removeOrderAlerts(snapshot.alerts, order.number),
    hourlyProduction: incrementCurrentHourProduction(
      snapshot.hourlyProduction,
      timestamp,
      actualIncrement,
    ),
    manualEntries: nextManualEntries,
  });
}

export function applyManualDowntimeRegistration(
  snapshot: ProductionSnapshot,
  payload: RegisterDowntimePayload,
) {
  const order = snapshot.orders.find((item) => item.id === payload.orderId);
  const operator = snapshot.operators.find(
    (item) => item.id === payload.operatorId,
  );
  const durationMinutes = clampInteger(
    Math.round(payload.durationMinutes),
    0,
    240,
  );

  if (!order || !operator || order.status === "concluida" || durationMinutes <= 0) {
    return snapshot;
  }

  const timestamp = buildManualTimestamp(snapshot);
  const reason = payload.reason.trim();

  const nextOrders = snapshot.orders.map<ProductionOrder>((item) =>
    item.id === order.id
      ? {
          ...item,
          status: "parada",
          lastUpdate: timestamp,
        }
      : item,
  );

  const nextSectors = snapshot.sectors.map<ProductionSector>((sector) =>
    sector.key === order.currentSector
      ? {
          ...sector,
          status: durationMinutes >= 20 ? "parado" : "atencao",
          downtimeMinutes: sector.downtimeMinutes + durationMinutes,
          efficiency: clampNumber(
            sector.efficiency - (durationMinutes >= 20 ? 8 : 4),
            50,
            99,
          ),
          machinesRunning: clampInteger(
            sector.machinesRunning - (durationMinutes >= 20 ? 2 : 1),
            0,
            sector.machinesTotal,
          ),
        }
      : sector,
  );

  const manualAlert = createManualAlert({
    id: `alert-manual-${snapshot.tick}-${snapshot.alerts.length + 1}`,
    fingerprint: `manual-stop-${order.number.toLowerCase()}`,
    timestamp,
    sector: order.currentSector,
    orderNumber: order.number,
    type: "maquina_parada",
    severity: durationMinutes >= 20 ? "high" : "medium",
    title: `Parada manual registrada em ${getSectorLabel(order.currentSector)}`,
    description: `${order.number} ficou indisponivel por ${durationMinutes} min. Motivo: ${reason}.`,
    source: "manual",
  });

  const nextManualEntries = prependManualEntry(snapshot.manualEntries, {
    id: `manual-${snapshot.tick}-${snapshot.manualEntries.length + 1}`,
    timestamp,
    action: "registrar_parada",
    orderId: order.id,
    orderNumber: order.number,
    productName: order.productName,
    sector: order.currentSector,
    operatorId: operator.id,
    operatorName: operator.name,
    durationMinutes,
    reason,
    note: payload.note?.trim(),
  });

  return recalculateSnapshot({
    ...snapshot,
    orders: nextOrders,
    sectors: nextSectors,
    alerts: prependAlert(removeOrderAlerts(snapshot.alerts, order.number), manualAlert),
    manualEntries: nextManualEntries,
  });
}

export function applyManualQualityRegistration(
  snapshot: ProductionSnapshot,
  payload: RegisterQualityPayload,
) {
  const order = snapshot.orders.find((item) => item.id === payload.orderId);
  const operator = snapshot.operators.find(
    (item) => item.id === payload.operatorId,
  );
  const quantity = clampInteger(Math.round(payload.quantity), 0, 9999);

  if (!order || !operator || order.status === "concluida" || quantity <= 0) {
    return snapshot;
  }

  const timestamp = buildManualTimestamp(snapshot);
  const inspectedVolume = Math.max(order.producedQuantity, quantity);
  const previousDefectUnits = Math.round(
    (order.defectRate / 100) * inspectedVolume,
  );
  const nextDefectRate = clampNumber(
    ((previousDefectUnits + quantity) / inspectedVolume) * 100,
    0.8,
    9.9,
  );
  const reason = payload.reason.trim();

  const nextOrders = snapshot.orders.map<ProductionOrder>((item) =>
    item.id === order.id
      ? {
          ...item,
          defectRate: nextDefectRate,
          lastUpdate: timestamp,
        }
      : item,
  );

  const nextSectors = snapshot.sectors.map<ProductionSector>((sector) =>
    sector.key === order.currentSector
      ? {
          ...sector,
          defects: sector.defects + quantity,
          status: "atencao",
          efficiency: clampNumber(
            sector.efficiency - (payload.category === "retrabalho" ? 4 : 3),
            50,
            99,
          ),
        }
      : sector,
  );

  const manualAlert = createManualAlert({
    id: `alert-manual-${snapshot.tick}-${snapshot.alerts.length + 1}`,
    fingerprint: `manual-quality-${order.number.toLowerCase()}`,
    timestamp,
    sector: order.currentSector,
    orderNumber: order.number,
    type: "retrabalho",
    severity: quantity >= 8 ? "high" : "medium",
    title:
      payload.category === "retrabalho"
        ? "Retrabalho registrado manualmente"
        : "Desvio de qualidade apontado manualmente",
    description: `${order.number} recebeu ${quantity} pecas em ${payload.category}. Motivo: ${reason}.`,
    source: "manual",
  });

  const nextManualEntries = prependManualEntry(snapshot.manualEntries, {
    id: `manual-${snapshot.tick}-${snapshot.manualEntries.length + 1}`,
    timestamp,
    action: "registrar_defeito",
    orderId: order.id,
    orderNumber: order.number,
    productName: order.productName,
    sector: order.currentSector,
    operatorId: operator.id,
    operatorName: operator.name,
    quantity,
    qualityCategory: payload.category,
    reason,
    note: payload.note?.trim(),
  });

  return recalculateSnapshot({
    ...snapshot,
    orders: nextOrders,
    sectors: nextSectors,
    alerts: prependAlert(snapshot.alerts, manualAlert),
    manualEntries: nextManualEntries,
  });
}

export function applyManualStageFinalization(
  snapshot: ProductionSnapshot,
  payload: FinalizeStagePayload,
) {
  const order = snapshot.orders.find((item) => item.id === payload.orderId);
  const operator = snapshot.operators.find(
    (item) => item.id === payload.operatorId,
  );

  if (!order || !operator || order.status === "concluida") {
    return snapshot;
  }

  const timestamp = buildManualTimestamp(snapshot);
  const currentIndex = sectorSequence.indexOf(order.currentSector);
  const isFinalSector =
    currentIndex === -1 || currentIndex === sectorSequence.length - 1;
  const nextSector = isFinalSector
    ? "expedicao"
    : sectorSequence[currentIndex + 1];
  const completionDelta = isFinalSector
    ? Math.max(order.plannedQuantity - order.producedQuantity, 0)
    : 0;

  const nextOrders = snapshot.orders.map<ProductionOrder>((item) =>
    item.id === order.id
      ? {
          ...item,
          currentSector: nextSector,
          producedQuantity: item.producedQuantity + completionDelta,
          status: isFinalSector ? "concluida" : "em_andamento",
          lastUpdate: timestamp,
        }
      : item,
  );

  const nextSectors = snapshot.sectors.map<ProductionSector>((sector) => {
    if (sector.key === order.currentSector) {
      return {
        ...sector,
        status: "operando",
        efficiency: clampNumber(sector.efficiency + 1, 60, 99),
      };
    }

    if (!isFinalSector && sector.key === nextSector) {
      return {
        ...sector,
        status: "operando",
      };
    }

    if (isFinalSector && sector.key === "expedicao") {
      return {
        ...sector,
        actualDailyOutput: sector.actualDailyOutput + completionDelta,
      };
    }

    return sector;
  });

  const nextManualEntries = prependManualEntry(snapshot.manualEntries, {
    id: `manual-${snapshot.tick}-${snapshot.manualEntries.length + 1}`,
    timestamp,
    action: "finalizar_etapa",
    orderId: order.id,
    orderNumber: order.number,
    productName: order.productName,
    sector: order.currentSector,
    operatorId: operator.id,
    operatorName: operator.name,
    quantity: completionDelta || undefined,
    note:
      payload.note?.trim() ||
      (isFinalSector
        ? "Lote encerrado manualmente na expedicao."
        : `Etapa concluida e liberada para ${getSectorLabel(nextSector)}.`),
  });

  return recalculateSnapshot({
    ...snapshot,
    dailyProduced: snapshot.dailyProduced + completionDelta,
    orders: nextOrders,
    sectors: nextSectors,
    alerts: removeOrderAlerts(snapshot.alerts, order.number),
    hourlyProduction: completionDelta
      ? incrementCurrentHourProduction(
          snapshot.hourlyProduction,
          timestamp,
          completionDelta,
        )
      : snapshot.hourlyProduction,
    manualEntries: nextManualEntries,
  });
}

function recalculateSnapshot(snapshot: ProductionSnapshot): ProductionSnapshot {
  const sectorsWithActiveOrders = snapshot.sectors.map((sector) => ({
    ...sector,
    activeOrders: snapshot.orders.filter(
      (order) =>
        order.currentSector === sector.key && order.status !== "concluida",
    ).length,
  }));
  const sectorsWithAlerts = applyAlertCounts(sectorsWithActiveOrders, snapshot.alerts);
  const defects = sectorsWithAlerts.reduce(
    (total, sector) => total + sector.defects,
    0,
  );
  const checkedVolume = Math.max(
    sectorsWithAlerts.reduce(
      (total, sector) => total + sector.actualDailyOutput,
      0,
    ),
    1,
  );

  return enrichProductionSnapshotWithWorkflow({
    ...snapshot,
    projectedCompletion: Math.min(
      103,
      Math.round((snapshot.dailyProduced / snapshot.dailyTarget) * 100),
    ),
    defectRate: clampNumber((defects / checkedVolume) * 100, 0, 99),
    downtimeMinutes: sectorsWithAlerts.reduce(
      (total, sector) => total + sector.downtimeMinutes,
      0,
    ),
    connectedOperators: calculateConnectedOperators(sectorsWithAlerts),
    sectors: sectorsWithAlerts,
  });
}

function prependManualEntry(
  currentEntries: ProductionManualEntry[],
  entry: ProductionManualEntry,
) {
  return [entry, ...currentEntries].slice(0, manualEntriesLimit);
}

function prependAlert(currentAlerts: ProductionAlert[], alert: ProductionAlert) {
  return [alert, ...currentAlerts].slice(0, alertLimit);
}

function removeOrderAlerts(
  alerts: ProductionAlert[],
  orderNumber: string,
) {
  return alerts.filter((alert) => alert.orderNumber !== orderNumber);
}

function incrementCurrentHourProduction(
  points: HourlyProductionPoint[],
  timestamp: string,
  quantity: number,
) {
  const currentHourLabel = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(timestamp));

  const currentPoint = points.find((point) => point.label === currentHourLabel);

  if (currentPoint) {
    return points.map((point) =>
      point.label === currentHourLabel
        ? {
            ...point,
            produced: point.produced + quantity,
          }
        : point,
    );
  }

  return [
    ...points.slice(-8),
    {
      label: currentHourLabel,
      produced: quantity,
      target: points.at(-1)?.target ?? quantity,
    },
  ];
}

function buildManualTimestamp(snapshot: ProductionSnapshot) {
  const date = new Date(snapshot.currentTime);
  date.setSeconds(date.getSeconds() + snapshot.manualEntries.length + 1);
  return date.toISOString();
}

function createManualAlert(
  alert: Omit<ProductionAlert, "active">,
): ProductionAlert {
  return {
    ...alert,
    active: true,
  };
}

function applyAlertCounts(
  sectors: ProductionSector[],
  alerts: ProductionAlert[],
) {
  const counts = alerts.reduce<Record<SectorKey | "fabrica", number>>(
    (accumulator, alert) => {
      accumulator[alert.sector] = (accumulator[alert.sector] ?? 0) + 1;
      return accumulator;
    },
    {
      fabrica: 0,
      corte: 0,
      costura: 0,
      acabamento: 0,
      expedicao: 0,
    },
  );

  return sectors.map((sector) => ({
    ...sector,
    alertCount: counts[sector.key] ?? 0,
  }));
}

function calculateConnectedOperators(sectors: ProductionSector[]) {
  return sectors.reduce((total, sector) => {
    const penalty =
      sector.status === "parado" ? 2 : sector.status === "atencao" ? 1 : 0;
    return total + Math.max(sector.operators - penalty, 0);
  }, 0);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSectorLabel(sector: SectorKey) {
  const labels: Record<SectorKey, string> = {
    corte: "Corte",
    costura: "Costura",
    acabamento: "Acabamento",
    expedicao: "Expedicao",
  };

  return labels[sector];
}

import type {
  LineStatus,
  MachineStatus,
  ProductionMachine,
  ProductionOrder,
  ProductionSnapshot,
  SectorKey,
} from "@/domain/production/types";
import { compareOrdersByOperationalPriority } from "@/lib/order-helpers";

export type SectorLineInsight = {
  id: string;
  name: string;
  status: LineStatus;
  efficiency: number;
  targetPerHour: number;
  taktTimeSeconds: number;
  operatorCount: number;
  operatorsPresent: number;
  supervisorName: string;
  backlogUnits: number;
  alertCount: number;
  orderNumbers: string[];
};

export type SectorMachineInsight = {
  id: string;
  code: string;
  name: string;
  lineName: string;
  lineId: string;
  status: MachineStatus;
  efficiency: number;
  runtimeTodayMinutes: number;
  maintenanceWindow: string;
  currentOrderNumber?: string;
  lastStopReason?: string;
};

export type SectorInsight = {
  key: SectorKey;
  sectorName: string;
  status: "operando" | "atencao" | "parado" | "setup";
  efficiency: number;
  produced: number;
  target: number;
  throughputGap: number;
  alertCount: number;
  supervisors: string[];
  bottleneckSummary: string;
  lines: SectorLineInsight[];
  machines: SectorMachineInsight[];
  orders: ProductionOrder[];
};

export function buildSectorInsights(snapshot: ProductionSnapshot) {
  return snapshot.sectors.map((sector) =>
    buildSectorInsight(snapshot, sector.key),
  );
}

export function buildSectorInsight(
  snapshot: ProductionSnapshot,
  sectorKey: SectorKey,
): SectorInsight {
  const sector = snapshot.sectors.find((item) => item.key === sectorKey);

  if (!sector) {
    throw new Error(`Sector ${sectorKey} not found in snapshot.`);
  }

  const sectorOrders = snapshot.orders
    .filter(
      (order) => order.currentSector === sectorKey && order.status !== "concluida",
    )
    .sort(compareOrdersByOperationalPriority);
  const sectorAlerts = snapshot.alerts.filter((alert) => alert.sector === sectorKey);
  const sectorLines = snapshot.lines.filter((line) => line.sector === sectorKey);

  const lines = sectorLines.map((line) => {
    const lineOrders = snapshot.orders.filter(
      (order) => order.lineId === line.id && order.status !== "concluida",
    );
    const lineAlerts = sectorAlerts.filter((alert) =>
      lineOrders.some((order) => order.number === alert.orderNumber),
    );
    const operators = snapshot.operators.filter((operator) =>
      line.operatorIds.includes(operator.id),
    );
    const delayedOrders = lineOrders.filter(
      (order) => order.status === "atrasada" || order.status === "parada",
    );
    const avgOperatorEfficiency =
      operators.reduce((total, operator) => total + operator.efficiencyScore, 0) /
      Math.max(operators.length, 1);
    const status = resolveLineStatus(sector.status, delayedOrders.length, lineAlerts.length);
    const efficiency = clampNumber(
      Math.round(
        sector.efficiency * 0.6 +
          avgOperatorEfficiency * 0.4 -
          delayedOrders.length * 4 -
          lineAlerts.length * 2,
      ),
      52,
      99,
    );
    const operatorsPresent = Math.max(
      operators.length -
        (status === "parada" ? 2 : status === "atencao" ? 1 : 0),
      0,
    );

    return {
      id: line.id,
      name: line.name,
      status,
      efficiency,
      targetPerHour: line.targetPerHour,
      taktTimeSeconds: line.taktTimeSeconds,
      operatorCount: operators.length,
      operatorsPresent,
      supervisorName:
        snapshot.operators.find((operator) => operator.id === line.supervisorId)?.name ??
        "Supervisao do turno",
      backlogUnits: lineOrders.reduce(
        (total, order) => total + Math.max(order.plannedQuantity - order.producedQuantity, 0),
        0,
      ),
      alertCount: lineAlerts.length,
      orderNumbers: lineOrders.map((order) => order.number),
    };
  });

  const machines = snapshot.machines
    .filter((machine) => machine.sector === sectorKey)
    .map((machine, index) =>
      buildMachineInsight(machine, index, lines, sectorOrders, sectorAlerts, sector),
    );

  const sortedLines = [...lines].sort(
    (left, right) =>
      right.backlogUnits / Math.max(right.targetPerHour, 1) -
      left.backlogUnits / Math.max(left.targetPerHour, 1),
  );
  const mainBottleneck = sortedLines[0];
  const bottleneckSummary =
    sectorAlerts[0]?.title ??
    (mainBottleneck
      ? `${mainBottleneck.name} com ${mainBottleneck.backlogUnits} pecas em fila e ${mainBottleneck.alertCount} alertas.`
      : "Fluxo sem gargalo relevante no momento.");

  return {
    key: sector.key,
    sectorName: sector.name,
    status: sector.status,
    efficiency: sector.efficiency,
    produced: sector.actualDailyOutput,
    target: sector.plannedDailyOutput,
    throughputGap: Math.max(sector.plannedDailyOutput - sector.actualDailyOutput, 0),
    alertCount: sector.alertCount,
    supervisors: lines.map((line) => line.supervisorName),
    bottleneckSummary,
    lines,
    machines,
    orders: sectorOrders,
  };
}

function buildMachineInsight(
  machine: ProductionMachine,
  index: number,
  lines: SectorLineInsight[],
  sectorOrders: ProductionOrder[],
  sectorAlerts: ProductionSnapshot["alerts"],
  sector: ProductionSnapshot["sectors"][number],
): SectorMachineInsight {
  const line = lines.find((item) => item.id === machine.lineId);
  const currentOrder = sectorOrders.find((order) => order.lineId === machine.lineId);
  const relatedAlert = sectorAlerts.find(
    (alert) =>
      alert.type === "maquina_parada" ||
      (currentOrder ? alert.orderNumber === currentOrder.number : false),
  );
  const shouldPauseByCapacity = index >= sector.machinesRunning;
  const status = resolveMachineStatus(line?.status ?? "operando", shouldPauseByCapacity, relatedAlert?.type);
  const efficiencyPenalty =
    status === "parada" ? 12 : status === "ajuste" ? 6 : status === "standby" ? 8 : 0;

  return {
    id: machine.id,
    code: machine.code,
    name: machine.name,
    lineName: line?.name ?? "Linha nao identificada",
    lineId: machine.lineId,
    status,
    efficiency: clampNumber(
      Math.round((machine.nominalEfficiency + sector.efficiency) / 2 - efficiencyPenalty),
      45,
      99,
    ),
    runtimeTodayMinutes: machine.runtimeTodayMinutes,
    maintenanceWindow: machine.maintenanceWindow,
    currentOrderNumber: currentOrder?.number,
    lastStopReason: relatedAlert?.description,
  };
}

function resolveLineStatus(
  sectorStatus: SectorInsight["status"],
  delayedOrders: number,
  alertCount: number,
): LineStatus {
  if (sectorStatus === "parado") {
    return "parada";
  }

  if (delayedOrders > 0 || alertCount > 0 || sectorStatus === "atencao") {
    return "atencao";
  }

  return "operando";
}

function resolveMachineStatus(
  lineStatus: LineStatus,
  shouldPauseByCapacity: boolean,
  alertType?: string,
): MachineStatus {
  if (alertType === "maquina_parada" || lineStatus === "parada") {
    return "parada";
  }

  if (shouldPauseByCapacity) {
    return "standby";
  }

  if (lineStatus === "atencao") {
    return "ajuste";
  }

  return "operando";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

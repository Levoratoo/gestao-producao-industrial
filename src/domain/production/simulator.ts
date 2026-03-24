import { sectorSequence } from "./mock-data";
import type {
  HourlyProductionPoint,
  ProductionAlert,
  DemoScenarioKey,
  ProductionOrder,
  OrderStatus,
  ProductionSector,
  ProductionSnapshot,
  SectorKey,
  SectorStatus,
} from "./types";
import { enrichProductionSnapshotWithWorkflow } from "./workflow";

const tickIntervalInMinutes = 5;

const sectorProfiles: Record<
  SectorKey,
  { minIncrement: number; maxIncrement: number; baselineEfficiency: number; machinesTotal: number }
> = {
  corte: {
    minIncrement: 8,
    maxIncrement: 16,
    baselineEfficiency: 94,
    machinesTotal: 5,
  },
  costura: {
    minIncrement: 14,
    maxIncrement: 26,
    baselineEfficiency: 90,
    machinesTotal: 14,
  },
  acabamento: {
    minIncrement: 10,
    maxIncrement: 18,
    baselineEfficiency: 91,
    machinesTotal: 6,
  },
  expedicao: {
    minIncrement: 12,
    maxIncrement: 20,
    baselineEfficiency: 87,
    machinesTotal: 4,
  },
};

type SimulationEvents = {
  materialHold: boolean;
  costuraSlowdown: boolean;
  acabamentoRetrabalho: boolean;
  expedicaoQueue: boolean;
  cortePause: boolean;
};

export function advanceProductionSimulation(
  snapshot: ProductionSnapshot,
): ProductionSnapshot {
  const nextTime = addMinutes(snapshot.currentTime, tickIntervalInMinutes);
  const nextTick = snapshot.tick + 1;
  const cycle = nextTick % 18;
  const events: SimulationEvents = applyScenarioEventBias(snapshot.scenarioKey, {
    materialHold: cycle <= 2,
    costuraSlowdown: cycle >= 3 && cycle <= 5,
    acabamentoRetrabalho: cycle >= 8 && cycle <= 10,
    expedicaoQueue: cycle >= 12 && cycle <= 14,
    cortePause: cycle === 16,
  });

  const nextOrders = snapshot.orders.map((order, index) =>
    evolveOrder(order, nextTick, nextTime, events, index),
  );

  const nextSectors = snapshot.sectors.map((sector, index) =>
    evolveSector(sector, nextOrders, nextTick, events, index),
  );

  const nextAlerts = buildAlerts(nextOrders, nextSectors, nextTime, events);
  const sectorsWithAlerts = applyAlertCounts(nextSectors, nextAlerts);
  const finishedIncrement = Math.max(
    0,
    sectorsWithAlerts.find((sector) => sector.key === "expedicao")!.actualDailyOutput -
      snapshot.sectors.find((sector) => sector.key === "expedicao")!.actualDailyOutput,
  );
  const dailyProduced = Math.min(
    snapshot.dailyTarget + 220,
    snapshot.dailyProduced + Math.round(finishedIncrement * 0.85),
  );
  const downtimeMinutes = sectorsWithAlerts.reduce(
    (total, sector) => total + sector.downtimeMinutes,
    0,
  );
  const defects = sectorsWithAlerts.reduce((total, sector) => total + sector.defects, 0);
  const checkedVolume = sectorsWithAlerts.reduce(
    (total, sector) => total + sector.actualDailyOutput,
    0,
  );
  const defectRate = Number(((defects / checkedVolume) * 100).toFixed(2));
  const projectedCompletion = Math.min(
    103,
    Math.round((dailyProduced / snapshot.dailyTarget) * 100),
  );

  return enrichProductionSnapshotWithWorkflow({
    ...snapshot,
    tick: nextTick,
    currentTime: nextTime,
    dailyProduced,
    projectedCompletion,
    defectRate,
    downtimeMinutes,
    connectedOperators: calculateConnectedOperators(sectorsWithAlerts),
    orders: nextOrders,
    sectors: sectorsWithAlerts,
    alerts: nextAlerts,
    hourlyProduction: updateHourlyProduction(
      snapshot.hourlyProduction,
      nextTime,
      Math.max(8, Math.round(finishedIncrement * 0.9)),
    ),
  });
}

function evolveOrder(
  order: ProductionOrder,
  tick: number,
  nextTime: string,
  events: SimulationEvents,
  index: number,
): ProductionOrder {
  if (order.status === "concluida") {
    return { ...order, lastUpdate: nextTime };
  }

  const cadenceStartTick = index * 3;
  if (tick < cadenceStartTick) {
    return {
      ...order,
      producedQuantity: 0,
      currentSector: "corte",
      status: "em_andamento",
      defectRate: clampNumber(order.defectRate - 0.01, 0.8, 3.4),
      lastUpdate: nextTime,
    };
  }

  const isMaterialBlocked = order.number === "OP-240316-05" && events.materialHold;
  const isDueSoonDelay =
    order.number === "OP-240316-02" && (events.acabamentoRetrabalho || events.expedicaoQueue);
  const isSectorStopped =
    (order.currentSector === "costura" && events.costuraSlowdown) ||
    (order.currentSector === "corte" && events.cortePause);

  const shouldPause = isMaterialBlocked || (order.number === "OP-240316-05" && events.cortePause);
  const shouldDelay = isDueSoonDelay || isPastDue(order.dueDate, nextTime, order);

  let increment = 0;
  if (!shouldPause) {
    const profile = sectorProfiles[order.currentSector];
    const cadenceTicks = tick - cadenceStartTick;
    const rampFactor = clampNumber(0.45 + cadenceTicks * 0.08, 0.45, 1);
    const rawIncrement =
      ((profile.minIncrement + profile.maxIncrement) / 2) * rampFactor;
    const penalty =
      order.currentSector === "costura" && events.costuraSlowdown
        ? 0.45
        : order.currentSector === "acabamento" && events.acabamentoRetrabalho
          ? 0.62
          : isSectorStopped
            ? 0
            : 1;

    increment = Math.round(rawIncrement * penalty);
  }

  const producedQuantity = Math.min(order.plannedQuantity, order.producedQuantity + increment);
  const progress = producedQuantity / order.plannedQuantity;
  const currentSector =
    producedQuantity >= order.plannedQuantity
      ? "expedicao"
      : resolveSectorFromProgress(progress);

  let status: OrderStatus = order.status;
  if (producedQuantity >= order.plannedQuantity) {
    status = "concluida";
  } else if (shouldPause) {
    status = "parada";
  } else if (shouldDelay) {
    status = "atrasada";
  } else {
    status = "em_andamento";
  }

  const defectAdjustment =
    currentSector === "acabamento" && events.acabamentoRetrabalho ? 0.08 : -0.03;

  return {
    ...order,
    producedQuantity,
    currentSector,
    status,
    defectRate: clampNumber(order.defectRate + defectAdjustment, 0.8, 3.4),
    lastUpdate: nextTime,
  };
}

function evolveSector(
  sector: ProductionSector,
  orders: ProductionOrder[],
  tick: number,
  events: SimulationEvents,
  index: number,
): ProductionSector {
  const activeOrders = orders.filter(
    (order) => order.currentSector === sector.key && order.status !== "concluida",
  );
  const profile = sectorProfiles[sector.key];
  const variance = seededVariance(tick * 7 + index);

  let efficiency =
    profile.baselineEfficiency + Math.round((variance - 0.5) * 6);
  let status: SectorStatus = "operando";
  let machinesRunning = profile.machinesTotal;
  let downtimeIncrement = 0;
  let defectIncrement = 0;

  if (sector.key === "costura" && events.costuraSlowdown) {
    efficiency -= 8;
    status = "atencao";
    machinesRunning = profile.machinesTotal - 1;
    downtimeIncrement = 4;
  }

  if (sector.key === "acabamento" && events.acabamentoRetrabalho) {
    efficiency -= 5;
    status = "atencao";
    defectIncrement = 2;
  }

  if (sector.key === "expedicao" && events.expedicaoQueue) {
    efficiency -= 6;
    status = "atencao";
    machinesRunning = profile.machinesTotal - 1;
    downtimeIncrement = 3;
  }

  if (sector.key === "corte" && events.cortePause) {
    efficiency = 61;
    status = "parado";
    machinesRunning = profile.machinesTotal - 2;
    downtimeIncrement = 8;
  }

  if (sector.key === "corte" && events.materialHold && activeOrders.length > 0) {
    efficiency -= 3;
    status = status === "parado" ? "parado" : "atencao";
  }

  efficiency = clampNumber(efficiency, 58, 98);

  const outputIncrement = activeOrders.reduce((total, order, orderIndex) => {
    if (order.status === "parada" && sector.key === "corte") {
      return total;
    }

    const varianceFactor = 0.85 + seededVariance(tick + orderIndex + order.plannedQuantity) * 0.35;
    const eventMultiplier =
      status === "parado"
        ? 0
        : status === "atencao"
          ? 0.74
          : 1;

    return total + Math.round(profile.minIncrement * varianceFactor * eventMultiplier);
  }, 0);

  return {
    ...sector,
    actualDailyOutput: Math.min(
      Math.round(sector.plannedDailyOutput * 1.08),
      sector.actualDailyOutput + Math.max(outputIncrement, status === "parado" ? 0 : 4),
    ),
    efficiency,
    status,
    activeOrders: activeOrders.length,
    machinesRunning,
    downtimeMinutes: sector.downtimeMinutes + downtimeIncrement,
    defects: sector.defects + defectIncrement,
    alertCount: 0,
  };
}

function buildAlerts(
  orders: ProductionOrder[],
  sectors: ProductionSector[],
  timestamp: string,
  events: SimulationEvents,
): ProductionAlert[] {
  const alerts: ProductionAlert[] = [];

  const costura = sectors.find((sector) => sector.key === "costura");
  const acabamento = sectors.find((sector) => sector.key === "acabamento");
  const corte = sectors.find((sector) => sector.key === "corte");
  const expedicao = sectors.find((sector) => sector.key === "expedicao");

  if (costura && costura.efficiency < 89) {
    alerts.push({
      id: `alert-costura-${timestamp}`,
      fingerprint: "eff-costura",
      type: "eficiencia_baixa",
      title: "Eficiencia abaixo da meta na costura",
      description:
        "Balanceamento do setor reduzido por microparadas em uma das linhas principais.",
      severity: events.costuraSlowdown ? "high" : "medium",
      sector: "costura",
      timestamp,
      active: true,
      source: "simulation",
    });
  }

  if (corte && (events.materialHold || corte.status === "parado")) {
    alerts.push({
      id: `alert-corte-${timestamp}`,
      fingerprint:
        corte.status === "parado" ? "machine-corte-main" : "supply-op-240316-05",
      type: corte.status === "parado" ? "maquina_parada" : "suprimento",
      title:
        corte.status === "parado"
          ? "Mesa automatica de corte em parada"
          : "OP bloqueada por falta de aviamento",
      description:
        corte.status === "parado"
          ? "Parada temporaria para ajuste mecanico na celula de corte."
          : "Aguardando reposicao de ziper para continuidade da jaqueta leve.",
      severity: "high",
      sector: "corte",
      orderNumber: "OP-240316-05",
      timestamp,
      active: true,
      source: "simulation",
    });
  }

  if (acabamento && acabamento.defects >= 15) {
    alerts.push({
      id: `alert-acabamento-${timestamp}`,
      fingerprint: "rework-op-240316-02",
      type: "retrabalho",
      title: "Retrabalho acima da faixa no acabamento",
      description:
        "Houve aumento de correcoes manuais em pecas da linha de polo masculina.",
      severity: events.acabamentoRetrabalho ? "high" : "medium",
      sector: "acabamento",
      orderNumber: "OP-240316-02",
      timestamp,
      active: true,
      source: "simulation",
    });
  }

  const overdueOrders = orders.filter(
    (order) => order.status === "atrasada" || order.status === "parada",
  );

  overdueOrders.slice(0, 2).forEach((order, index) => {
    alerts.push({
      id: `alert-order-${index}-${timestamp}`,
      fingerprint: `late-${order.number.toLowerCase()}`,
      type: "op_atrasada",
      title: `${order.number} exige acao da lideranca`,
      description: `${order.productName} esta em ${getSectorLabel(order.currentSector)} com risco de desvio de prazo.`,
      severity: order.status === "parada" ? "high" : "medium",
      sector: order.currentSector,
      orderNumber: order.number,
      timestamp,
      active: true,
      source: "simulation",
    });
  });

  if (expedicao && expedicao.efficiency < 85) {
    alerts.push({
      id: `alert-exp-${timestamp}`,
      fingerprint: "eff-expedicao",
      type: "eficiencia_baixa",
      title: "Fila de expedicao acima do esperado",
      description:
        "Conferencia final e embalagem operam abaixo do ritmo nominal do turno.",
      severity: events.expedicaoQueue ? "medium" : "info",
      sector: "expedicao",
      timestamp,
      active: true,
      source: "simulation",
    });
  }

  return alerts;
}

function updateHourlyProduction(
  points: HourlyProductionPoint[],
  timestamp: string,
  increment: number,
) {
  const nextHourLabel = formatHourLabel(timestamp);
  const existingPoint = points.find((point) => point.label === nextHourLabel);

  if (existingPoint) {
    return points.map((point) =>
      point.label === nextHourLabel
        ? { ...point, produced: point.produced + increment }
        : point,
    );
  }

  const lastTarget = points.at(-1)?.target ?? 180;
  const targetAdjustment = Math.round(
    lastTarget * (0.98 + seededVariance(points.length + increment) * 0.08),
  );

  return [
    ...points.slice(-8),
    {
      label: nextHourLabel,
      produced: increment,
      target: targetAdjustment,
    },
  ];
}

function resolveSectorFromProgress(progress: number): SectorKey {
  if (progress < 0.22) {
    return sectorSequence[0];
  }
  if (progress < 0.67) {
    return sectorSequence[1];
  }
  if (progress < 0.9) {
    return sectorSequence[2];
  }
  return sectorSequence[3];
}

function calculateConnectedOperators(sectors: ProductionSector[]) {
  return sectors.reduce((total, sector) => {
    const penalty = sector.status === "parado" ? 2 : sector.status === "atencao" ? 1 : 0;
    return total + Math.max(sector.operators - penalty, 0);
  }, 0);
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

function formatHourLabel(timestamp: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(timestamp));
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

function addMinutes(timestamp: string, minutes: number) {
  const next = new Date(timestamp);
  next.setMinutes(next.getMinutes() + minutes);
  return next.toISOString();
}

function seededVariance(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

function isPastDue(
  dueDate: string,
  referenceDate: string,
  order: ProductionOrder,
) {
  const dueTime = new Date(dueDate).getTime();
  const referenceTime = new Date(referenceDate).getTime();
  const completionRatio = order.producedQuantity / order.plannedQuantity;
  return referenceTime > dueTime && completionRatio < 0.95;
}

function applyScenarioEventBias(
  scenarioKey: DemoScenarioKey,
  baseEvents: SimulationEvents,
): SimulationEvents {
  if (scenarioKey === "turno_estavel") {
    return {
      materialHold: false,
      costuraSlowdown: false,
      acabamentoRetrabalho: false,
      expedicaoQueue: false,
      cortePause: false,
    };
  }

  if (scenarioKey === "gargalo_costura") {
    return {
      materialHold: false,
      costuraSlowdown: true,
      acabamentoRetrabalho: true,
      expedicaoQueue: true,
      cortePause: false,
    };
  }

  return {
    ...baseEvents,
    materialHold: true,
    costuraSlowdown: true,
    acabamentoRetrabalho: false,
    expedicaoQueue: true,
    cortePause: true,
  };
}

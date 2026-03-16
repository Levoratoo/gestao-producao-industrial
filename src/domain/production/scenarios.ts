import type {
  DemoScenarioKey,
  ProductionAlert,
  ProductionOrder,
  ProductionScenarioPreset,
  ProductionSector,
  ProductionSnapshot,
} from "./types";

export const productionScenarioPresets: ProductionScenarioPreset[] = [
  {
    key: "turno_estavel",
    label: "Turno estavel",
    shortLabel: "Estavel",
    description: "Operacao controlada, alertas pontuais e fluxo regular entre setores.",
    tone: "success",
  },
  {
    key: "gargalo_costura",
    label: "Gargalo em costura",
    shortLabel: "Costura",
    description: "Balanceamento degradado em costura, fila crescente e impacto em prazo.",
    tone: "warning",
  },
  {
    key: "parada_critica",
    label: "Parada critica",
    shortLabel: "Critica",
    description: "Parada relevante com multiplos alertas de alta severidade e ordens bloqueadas.",
    tone: "danger",
  },
];

export function getScenarioPreset(scenarioKey: DemoScenarioKey) {
  return (
    productionScenarioPresets.find((scenario) => scenario.key === scenarioKey) ??
    productionScenarioPresets[0]
  );
}

export function applyScenarioPreset(
  snapshot: ProductionSnapshot,
  scenarioKey: DemoScenarioKey,
): ProductionSnapshot {
  const timestamp = snapshot.currentTime;
  const nextOrders = snapshot.orders.map((order) =>
    updateOrderForScenario(order, scenarioKey, timestamp),
  );
  const nextSectors = snapshot.sectors.map((sector) =>
    updateSectorForScenario(sector, scenarioKey),
  );
  const nextAlerts = buildScenarioAlerts(snapshot, scenarioKey, timestamp);
  const nextDailyProduced = nextSectors.find(
    (sector) => sector.key === "expedicao",
  )?.actualDailyOutput ?? snapshot.dailyProduced;
  const nextDowntime = nextSectors.reduce(
    (total, sector) => total + sector.downtimeMinutes,
    0,
  );
  const nextDefectRate = Number(
    (
      nextSectors.reduce((total, sector) => total + sector.defects, 0) /
      Math.max(
        nextSectors.reduce((total, sector) => total + sector.actualDailyOutput, 0),
        1,
      )
    ).toFixed(4),
  );

  return {
    ...snapshot,
    scenarioKey,
    dailyProduced: nextDailyProduced,
    projectedCompletion: Math.min(
      103,
      Math.round((nextDailyProduced / snapshot.dailyTarget) * 100),
    ),
    downtimeMinutes: nextDowntime,
    defectRate: Number((nextDefectRate * 100).toFixed(2)),
    connectedOperators: nextSectors.reduce(
      (total, sector) =>
        total +
        Math.max(
          sector.operators - (sector.status === "parado" ? 2 : sector.status === "atencao" ? 1 : 0),
          0,
        ),
      0,
    ),
    orders: nextOrders,
    sectors: nextSectors,
    alerts: nextAlerts,
  };
}

function updateOrderForScenario(
  order: ProductionOrder,
  scenarioKey: DemoScenarioKey,
  timestamp: string,
): ProductionOrder {
  if (scenarioKey === "turno_estavel") {
    return {
      ...order,
      status: order.status === "parada" ? "em_andamento" : order.status,
      currentSector:
        order.number === "OP-240316-02" ? "acabamento" : order.currentSector,
      defectRate: clampNumber(order.defectRate - 0.3, 0.8, 3.2),
      lastUpdate: timestamp,
    };
  }

  if (scenarioKey === "gargalo_costura") {
    if (order.number === "OP-240316-01" || order.number === "OP-240316-03") {
      return {
        ...order,
        status: "atrasada",
        currentSector: "costura",
        defectRate: clampNumber(order.defectRate + 0.7, 0.8, 5.4),
        lastUpdate: timestamp,
      };
    }

    return {
      ...order,
      lastUpdate: timestamp,
    };
  }

  if (order.number === "OP-240316-05") {
    return {
      ...order,
      status: "parada",
      currentSector: "corte",
      lastUpdate: timestamp,
    };
  }

  if (order.number === "OP-240316-04") {
    return {
      ...order,
      status: "atrasada",
      currentSector: "expedicao",
      lastUpdate: timestamp,
    };
  }

  return {
    ...order,
    status: order.status === "concluida" ? "concluida" : "atrasada",
    defectRate: clampNumber(order.defectRate + 0.4, 0.8, 5.8),
    lastUpdate: timestamp,
  };
}

function updateSectorForScenario(
  sector: ProductionSector,
  scenarioKey: DemoScenarioKey,
): ProductionSector {
  if (scenarioKey === "turno_estavel") {
    return {
      ...sector,
      status: "operando",
      efficiency: clampNumber(sector.efficiency + 4, 75, 97),
      downtimeMinutes: Math.max(sector.downtimeMinutes - 5, 3),
      defects: Math.max(sector.defects - 2, 1),
      machinesRunning: Math.min(sector.machinesTotal, sector.machinesRunning + 1),
    };
  }

  if (scenarioKey === "gargalo_costura") {
    if (sector.key === "costura") {
      return {
        ...sector,
        status: "atencao",
        efficiency: 74,
        downtimeMinutes: sector.downtimeMinutes + 18,
        defects: sector.defects + 8,
        machinesRunning: Math.max(sector.machinesRunning - 3, 7),
      };
    }

    if (sector.key === "acabamento") {
      return {
        ...sector,
        status: "atencao",
        efficiency: clampNumber(sector.efficiency - 6, 58, 95),
        defects: sector.defects + 4,
      };
    }

    return {
      ...sector,
      status: sector.key === "expedicao" ? "atencao" : sector.status,
      efficiency: clampNumber(sector.efficiency - (sector.key === "expedicao" ? 4 : 1), 60, 96),
    };
  }

  if (sector.key === "corte") {
    return {
      ...sector,
      status: "parado",
      efficiency: 58,
      downtimeMinutes: sector.downtimeMinutes + 24,
      machinesRunning: Math.max(sector.machinesRunning - 3, 1),
      defects: sector.defects + 3,
    };
  }

  if (sector.key === "expedicao") {
    return {
      ...sector,
      status: "atencao",
      efficiency: 72,
      downtimeMinutes: sector.downtimeMinutes + 12,
      machinesRunning: Math.max(sector.machinesRunning - 2, 1),
      defects: sector.defects + 2,
    };
  }

  return {
    ...sector,
    status: "atencao",
    efficiency: clampNumber(sector.efficiency - 8, 54, 92),
    downtimeMinutes: sector.downtimeMinutes + 10,
    defects: sector.defects + 5,
  };
}

function buildScenarioAlerts(
  snapshot: ProductionSnapshot,
  scenarioKey: DemoScenarioKey,
  timestamp: string,
): ProductionAlert[] {
  if (scenarioKey === "turno_estavel") {
    return [
      {
        id: `scenario-${scenarioKey}-1`,
        fingerprint: "scenario-stable-info",
        type: "eficiencia_baixa",
        title: "Turno em estabilidade monitorada",
        description:
          "Operacao com baixa dispersao entre linhas. Alertas mantidos apenas para monitoramento preventivo.",
        severity: "info",
        sector: "fabrica",
        timestamp,
        active: true,
        source: "simulation",
      },
    ];
  }

  if (scenarioKey === "gargalo_costura") {
    return [
      {
        id: `scenario-${scenarioKey}-1`,
        fingerprint: "scenario-costura-eff",
        type: "eficiencia_baixa",
        title: "Costura abaixo do ritmo nominal",
        description:
          "Balanceamento degradado na principal linha de costura, com fila acumulada e impacto na passagem para acabamento.",
        severity: "high",
        sector: "costura",
        timestamp,
        active: true,
        source: "simulation",
      },
      {
        id: `scenario-${scenarioKey}-2`,
        fingerprint: "scenario-costura-op01",
        type: "op_atrasada",
        title: "OP-240316-01 exigindo reprogramacao",
        description:
          "Camiseta basica permaneceu em costura alem da janela prevista e requer priorizacao do lider.",
        severity: "medium",
        sector: "costura",
        orderNumber: "OP-240316-01",
        timestamp,
        active: true,
        source: "simulation",
      },
      {
        id: `scenario-${scenarioKey}-3`,
        fingerprint: "scenario-costura-rework",
        type: "retrabalho",
        title: "Retrabalho ampliado na passagem para acabamento",
        description:
          "Pecas da polo masculina acumulam ajuste final acima da faixa nominal do turno.",
        severity: "medium",
        sector: "acabamento",
        orderNumber: "OP-240316-02",
        timestamp,
        active: true,
        source: "simulation",
      },
    ];
  }

  return [
    {
      id: `scenario-${scenarioKey}-1`,
      fingerprint: "scenario-critical-stop",
      type: "maquina_parada",
      title: "Parada critica na mesa automatica de corte",
      description:
        "Celula principal de corte indisponivel, bloqueando a liberacao da jaqueta leve e pressionando o restante do fluxo.",
      severity: "high",
      sector: "corte",
      orderNumber: "OP-240316-05",
      timestamp,
      active: true,
      source: "simulation",
    },
    {
      id: `scenario-${scenarioKey}-2`,
      fingerprint: "scenario-critical-exp",
      type: "eficiencia_baixa",
      title: "Expedicao operando abaixo da janela de despacho",
      description:
        "Conferencia final e embalagem acumulam fila acima do previsto para o fim do turno.",
      severity: "high",
      sector: "expedicao",
      orderNumber: "OP-240316-04",
      timestamp,
      active: true,
      source: "simulation",
    },
    {
      id: `scenario-${scenarioKey}-3`,
      fingerprint: "scenario-critical-delay",
      type: "op_atrasada",
      title: "Multiplas OPs com risco de prazo",
      description:
        "O bloqueio no corte e a reducao do ritmo nas etapas seguintes elevam o risco de desvio no mix do turno.",
      severity: "high",
      sector: "fabrica",
      timestamp,
      active: true,
      source: "simulation",
    },
  ];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

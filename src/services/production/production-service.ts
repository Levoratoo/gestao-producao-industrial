import {
  applyManualDowntimeRegistration,
  applyManualProductionReport,
  applyManualQualityRegistration,
  applyManualStageFinalization,
  applyManualStartOrder,
} from "@/domain/production/manual-actions";
import { createInitialProductionSnapshot } from "@/domain/production/mock-data";
import {
  applyScenarioPreset,
  productionScenarioPresets,
} from "@/domain/production/scenarios";
import {
  acknowledgeProductionAlert,
  normalizeProductionSnapshot,
  reconcileAlertTimeline,
} from "@/domain/production/state";
import { advanceProductionSimulation } from "@/domain/production/simulator";
import type {
  DemoScenarioKey,
  FinalizeStagePayload,
  ProductionSnapshot,
  RegisterDowntimePayload,
  RegisterQualityPayload,
  ReportProductionPayload,
  StartOrderPayload,
} from "@/domain/production/types";
import type {
  ProductionBootstrapResponse,
  ProductionRuntimeState,
} from "@/services/production/contracts";
import {
  createLocalProductionRepository,
  type ProductionRepository,
} from "@/services/production/local-production-repository";

type AcknowledgeAlertPayload = {
  alertId: string;
  acknowledgedBy: string;
};

export interface ProductionService {
  bootstrap: () => Promise<ProductionBootstrapResponse & { gatewayMode: "local" }>;
  getInitialSnapshot: () => ProductionSnapshot;
  advance: (snapshot: ProductionSnapshot) => ProductionSnapshot;
  startOrder: (
    snapshot: ProductionSnapshot,
    payload: StartOrderPayload,
  ) => ProductionSnapshot;
  reportProduction: (
    snapshot: ProductionSnapshot,
    payload: ReportProductionPayload,
  ) => ProductionSnapshot;
  registerDowntime: (
    snapshot: ProductionSnapshot,
    payload: RegisterDowntimePayload,
  ) => ProductionSnapshot;
  registerQuality: (
    snapshot: ProductionSnapshot,
    payload: RegisterQualityPayload,
  ) => ProductionSnapshot;
  finalizeStage: (
    snapshot: ProductionSnapshot,
    payload: FinalizeStagePayload,
  ) => ProductionSnapshot;
  acknowledgeAlert: (
    snapshot: ProductionSnapshot,
    payload: AcknowledgeAlertPayload,
  ) => ProductionSnapshot;
  applyScenario: (
    snapshot: ProductionSnapshot,
    scenarioKey: DemoScenarioKey,
  ) => ProductionSnapshot;
  reset: () => ProductionSnapshot;
}

export function createProductionService(
  repository: ProductionRepository = createLocalProductionRepository(),
): ProductionService {
  return {
    async bootstrap() {
      const snapshot = repository.hasSnapshot()
        ? repository.load()
        : normalizeProductionSnapshot(createInitialProductionSnapshot());
      repository.save(snapshot);

      const bootstrapPayload = createLocalBootstrapResponse(snapshot);

      return {
        ...bootstrapPayload,
        gatewayMode: "local",
      };
    },
    getInitialSnapshot() {
      const snapshot = repository.load();
      repository.save(snapshot);
      return snapshot;
    },
    advance(snapshot) {
      return applyTransition(snapshot, advanceProductionSimulation, repository);
    },
    startOrder(snapshot, payload) {
      return applyTransition(
        snapshot,
        (currentSnapshot) => applyManualStartOrder(currentSnapshot, payload),
        repository,
      );
    },
    reportProduction(snapshot, payload) {
      return applyTransition(
        snapshot,
        (currentSnapshot) =>
          applyManualProductionReport(currentSnapshot, payload),
        repository,
      );
    },
    registerDowntime(snapshot, payload) {
      return applyTransition(
        snapshot,
        (currentSnapshot) =>
          applyManualDowntimeRegistration(currentSnapshot, payload),
        repository,
      );
    },
    registerQuality(snapshot, payload) {
      return applyTransition(
        snapshot,
        (currentSnapshot) =>
          applyManualQualityRegistration(currentSnapshot, payload),
        repository,
      );
    },
    finalizeStage(snapshot, payload) {
      return applyTransition(
        snapshot,
        (currentSnapshot) => applyManualStageFinalization(currentSnapshot, payload),
        repository,
      );
    },
    acknowledgeAlert(snapshot, payload) {
      const nextSnapshot = acknowledgeProductionAlert(
        snapshot,
        payload.alertId,
        payload.acknowledgedBy,
      );

      repository.save(nextSnapshot);
      return nextSnapshot;
    },
    applyScenario(snapshot, scenarioKey) {
      return applyTransition(
        snapshot,
        (currentSnapshot) => applyScenarioPreset(currentSnapshot, scenarioKey),
        repository,
      );
    },
    reset() {
      const snapshot = normalizeProductionSnapshot(
        createInitialProductionSnapshot(),
      );
      repository.save(snapshot);
      return snapshot;
    },
  };
}

function applyTransition(
  snapshot: ProductionSnapshot,
  transition: (snapshot: ProductionSnapshot) => ProductionSnapshot,
  repository: ProductionRepository,
) {
  const normalizedSnapshot = normalizeProductionSnapshot(snapshot);
  const transitionedSnapshot = transition(normalizedSnapshot);
  const reconciledSnapshot = reconcileAlertTimeline(
    normalizedSnapshot,
    transitionedSnapshot,
  );

  repository.save(reconciledSnapshot);
  return reconciledSnapshot;
}

function createLocalBootstrapResponse(
  snapshot: ProductionSnapshot,
): ProductionBootstrapResponse {
  const runtime: ProductionRuntimeState = {
    mode: "client",
    transport: "timer",
    isPaused: false,
    speedKey: "normal",
    tickIntervalMs: 4000,
    connectionStatus: "local",
    startedAt: new Date().toISOString(),
    lastSyncAt: snapshot.currentTime,
  };

  return {
    snapshot,
    scenarios: productionScenarioPresets,
    runtime,
    capabilities: {
      mutations: "client",
      reports: "client",
      runtimeApiAvailable: false,
    },
  };
}

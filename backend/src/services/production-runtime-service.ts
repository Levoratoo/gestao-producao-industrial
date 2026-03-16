import { applyManualDowntimeRegistration, applyManualProductionReport, applyManualQualityRegistration, applyManualStageFinalization, applyManualStartOrder } from "../../../src/domain/production/manual-actions.js";
import { createInitialProductionSnapshot } from "../../../src/domain/production/mock-data.js";
import { applyScenarioPreset, productionScenarioPresets } from "../../../src/domain/production/scenarios.js";
import { acknowledgeProductionAlert, normalizeProductionSnapshot, reconcileAlertTimeline } from "../../../src/domain/production/state.js";
import { advanceProductionSimulation } from "../../../src/domain/production/simulator.js";
import type {
  DemoScenarioKey,
  FinalizeStagePayload,
  ProductionSnapshot,
  RegisterDowntimePayload,
  RegisterQualityPayload,
  ReportProductionPayload,
  SimulationSpeedKey,
  StartOrderPayload,
} from "../../../src/domain/production/types.js";
import type {
  ProductionActionResponse,
  ProductionBootstrapResponse,
  ProductionHealthResponse,
  ProductionRuntimeState,
  ProductionSnapshotResponse,
} from "../../../src/services/production/contracts.js";
import type { BackendEnv } from "../config/env.js";
import { createProductionStateRepository } from "../repositories/production-state-repository.js";

type Logger = {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
};

type DatabaseHealthcheck = () => Promise<{
  status: "connected" | "disconnected";
  latencyMs?: number;
  error?: string;
}>;

export function createProductionRuntimeService({
  env,
  pool,
  logger,
  databaseHealthcheck,
}: {
  env: BackendEnv;
  pool: Parameters<typeof createProductionStateRepository>[0];
  logger: Logger;
  databaseHealthcheck: DatabaseHealthcheck;
}) {
  const repository = createProductionStateRepository(pool);
  const subscribers = new Set<(payload: ProductionSnapshotResponse) => void>();
  const state = {
    snapshot: normalizeProductionSnapshot(createInitialProductionSnapshot()),
    runtime: {
      ...repository.createDefaultRuntimeState(),
      tickIntervalMs: env.SYNC_INTERVAL_MS,
      startedAt: new Date().toISOString(),
    } satisfies ProductionRuntimeState,
  };
  let syncTimer: NodeJS.Timeout | null = null;
  let updateChain = Promise.resolve();

  const api = {
    async initialize() {
      const persistedState = await repository.load();

      if (persistedState) {
        state.snapshot = persistedState.snapshot;
        state.runtime = {
          ...persistedState.runtime,
          connectionStatus: "connected",
          transport: "sse",
          mode: "remote",
          startedAt: new Date().toISOString(),
          tickIntervalMs: persistedState.runtime.tickIntervalMs || env.SYNC_INTERVAL_MS,
        };
        logger.info("production runtime restored from database", {
          tick: state.snapshot.tick,
          scenarioKey: state.snapshot.scenarioKey,
        });
      } else {
        await repository.save({
          snapshot: state.snapshot,
          runtime: state.runtime,
        });
        logger.info("production runtime seeded with initial snapshot", {
          tick: state.snapshot.tick,
        });
      }
    },
    async start() {
      restartTimer();
      logger.info("automatic order update service started", {
        tickIntervalMs: state.runtime.tickIntervalMs,
        transport: state.runtime.transport,
      });
    },
    stop() {
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
    },
    subscribe(listener: (payload: ProductionSnapshotResponse) => void) {
      subscribers.add(listener);
      listener(api.getSnapshotResponse());

      return () => {
        subscribers.delete(listener);
      };
    },
    getBootstrapResponse(): ProductionBootstrapResponse {
      return {
        snapshot: state.snapshot,
        scenarios: productionScenarioPresets,
        runtime: state.runtime,
        capabilities: {
          mutations: "api",
          reports: "client",
          runtimeApiAvailable: true,
        },
      };
    },
    getSnapshotResponse(): ProductionSnapshotResponse {
      return {
        snapshot: state.snapshot,
        runtime: state.runtime,
      };
    },
    async getHealthResponse(): Promise<ProductionHealthResponse> {
      const database = await databaseHealthcheck();

      return {
        status: database.status === "connected" ? "ok" : "degraded",
        service: "industrial-production-backend",
        environment: env.NODE_ENV,
        version: env.APP_VERSION,
        timestamp: new Date().toISOString(),
        database,
        runtime: {
          ...state.runtime,
          tick: state.snapshot.tick,
        },
      };
    },
    async advanceTick(reason: "interval" | "manual" = "interval") {
      return queueUpdate(async () => {
        const nextSnapshot = advanceProductionSimulation(state.snapshot);
        await commitTransition(nextSnapshot, "tick-advanced", {
          reason,
          tick: nextSnapshot.tick,
        });
      });
    },
    async startOrder(payload: StartOrderPayload) {
      return applyDomainAction("start-order", () =>
        applyManualStartOrder(state.snapshot, payload),
      );
    },
    async reportProduction(payload: ReportProductionPayload) {
      return applyDomainAction("report-production", () =>
        applyManualProductionReport(state.snapshot, payload),
      );
    },
    async registerDowntime(payload: RegisterDowntimePayload) {
      return applyDomainAction("register-downtime", () =>
        applyManualDowntimeRegistration(state.snapshot, payload),
      );
    },
    async registerQuality(payload: RegisterQualityPayload) {
      return applyDomainAction("register-quality", () =>
        applyManualQualityRegistration(state.snapshot, payload),
      );
    },
    async finalizeStage(payload: FinalizeStagePayload) {
      return applyDomainAction("finalize-stage", () =>
        applyManualStageFinalization(state.snapshot, payload),
      );
    },
    async acknowledgeAlert(payload: { alertId: string; acknowledgedBy: string }) {
      return applyDomainAction("acknowledge-alert", () =>
        acknowledgeProductionAlert(state.snapshot, payload.alertId, payload.acknowledgedBy),
      );
    },
    async applyScenario(payload: { scenarioKey: DemoScenarioKey }) {
      return applyDomainAction("apply-scenario", () =>
        applyScenarioPreset(state.snapshot, payload.scenarioKey),
      );
    },
    async reset() {
      return applyDomainAction("reset", () =>
        normalizeProductionSnapshot(createInitialProductionSnapshot()),
      );
    },
    async togglePaused() {
      return queueUpdate(async () => {
        state.runtime = {
          ...state.runtime,
          isPaused: !state.runtime.isPaused,
          lastSyncAt: new Date().toISOString(),
        };
        restartTimer();
        await persistRuntimeOnly("toggle-paused");
        broadcast();

        logger.info("automatic order update service toggled", {
          isPaused: state.runtime.isPaused,
        });

        return api.getSnapshotResponse();
      });
    },
    async setSpeed(payload: { speedKey: SimulationSpeedKey }) {
      return queueUpdate(async () => {
        state.runtime = {
          ...state.runtime,
          speedKey: payload.speedKey,
          tickIntervalMs: resolveTickInterval(env.SYNC_INTERVAL_MS, payload.speedKey),
          lastSyncAt: new Date().toISOString(),
        };
        restartTimer();
        await persistRuntimeOnly("set-speed");
        broadcast();

        logger.info("automatic order update speed changed", {
          speedKey: state.runtime.speedKey,
          tickIntervalMs: state.runtime.tickIntervalMs,
        });

        return api.getSnapshotResponse();
      });
    },
    async stepSimulation() {
      return queueUpdate(async () => {
        const nextSnapshot = advanceProductionSimulation(state.snapshot);
        await commitTransition(nextSnapshot, "step-simulation", {
          tick: nextSnapshot.tick,
        });
        return api.getSnapshotResponse();
      });
    },
  };

  return api;

  function queueUpdate<T>(work: () => Promise<T>) {
    const nextJob = updateChain.then(work);
    updateChain = nextJob.then(
      () => undefined,
      (error) => {
        logger.error("automatic order update failure", {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    );

    return nextJob;
  }

  async function applyDomainAction(
    eventType: string,
    transition: () => ProductionSnapshot,
  ): Promise<ProductionActionResponse> {
    return queueUpdate(async () => {
      const nextSnapshot = transition();
      await commitTransition(nextSnapshot, eventType, {
        tick: nextSnapshot.tick,
        scenarioKey: nextSnapshot.scenarioKey,
      });
      return {
        snapshot: state.snapshot,
        runtime: state.runtime,
      };
    });
  }

  async function commitTransition(
    nextSnapshot: ProductionSnapshot,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const reconciledSnapshot = reconcileAlertTimeline(state.snapshot, nextSnapshot);

    state.snapshot = reconciledSnapshot;
    state.runtime = {
      ...state.runtime,
      lastSyncAt: new Date().toISOString(),
      lastError: undefined,
    };

    await repository.save({
      snapshot: state.snapshot,
      runtime: state.runtime,
    });
    await repository.appendEvent(eventType, {
      ...payload,
      tick: state.snapshot.tick,
      currentTime: state.snapshot.currentTime,
    });
    broadcast();
  }

  async function persistRuntimeOnly(eventType: string) {
    await repository.save({
      snapshot: state.snapshot,
      runtime: state.runtime,
    });
    await repository.appendEvent(eventType, {
      tick: state.snapshot.tick,
      currentTime: state.snapshot.currentTime,
      isPaused: state.runtime.isPaused,
      speedKey: state.runtime.speedKey,
    });
  }

  function restartTimer() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    if (state.runtime.isPaused) {
      return;
    }

    syncTimer = setInterval(() => {
      void (async () => {
        try {
          await queueUpdate(async () => {
            const nextSnapshot = advanceProductionSimulation(state.snapshot);
            await commitTransition(nextSnapshot, "tick-advanced", {
              reason: "interval",
            });
          });
        } catch (error) {
          state.runtime = {
            ...state.runtime,
            lastError: error instanceof Error ? error.message : String(error),
          };
          logger.error("automatic order update loop failed", {
            error: state.runtime.lastError,
          });
        }
      })();
    }, state.runtime.tickIntervalMs);
  }

  function broadcast() {
    const payload = {
      snapshot: state.snapshot,
      runtime: state.runtime,
    } satisfies ProductionSnapshotResponse;

    subscribers.forEach((listener) => {
      listener(payload);
    });
  }
}

function resolveTickInterval(
  baseIntervalMs: number,
  speedKey: SimulationSpeedKey,
) {
  if (speedKey === "slow") {
    return Math.round(baseIntervalMs * 1.6);
  }

  if (speedKey === "fast") {
    return Math.max(1000, Math.round(baseIntervalMs * 0.5));
  }

  return baseIntervalMs;
}

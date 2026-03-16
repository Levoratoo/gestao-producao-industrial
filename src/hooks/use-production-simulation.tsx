"use client";

import type {
  DemoScenarioKey,
  FinalizeStagePayload,
  ProductionSnapshot,
  ProductionScenarioPreset,
  RegisterDowntimePayload,
  RegisterQualityPayload,
  ReportProductionPayload,
  SimulationSpeedKey,
  StartOrderPayload,
} from "@/domain/production/types";
import { createInitialProductionSnapshot } from "@/domain/production/mock-data";
import { productionScenarioPresets } from "@/domain/production/scenarios";
import { getFrontendRuntimeConfig } from "@/config/runtime-config";
import type {
  RemoteActionPayloadMap,
  ProductionConnectionStatus,
  ProductionRuntimeState,
} from "@/services/production/contracts";
import { createProductionService } from "@/services/production/production-service";
import {
  createRemoteProductionClient,
  getFallbackPollingInterval,
} from "@/services/production/remote-production-client";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ProductionSimulationControls = ProductionRuntimeState & {
  scenarioKey: DemoScenarioKey;
  scenarios: ProductionScenarioPreset[];
  gatewayMode: "local" | "api";
};

type ProductionSimulationActions = {
  startOrder: (payload: StartOrderPayload) => void;
  reportProduction: (payload: ReportProductionPayload) => void;
  registerDowntime: (payload: RegisterDowntimePayload) => void;
  registerQuality: (payload: RegisterQualityPayload) => void;
  finalizeStage: (payload: FinalizeStagePayload) => void;
  acknowledgeAlert: (payload: {
    alertId: string;
    acknowledgedBy: string;
  }) => void;
  resetSimulation: () => void;
  togglePaused: () => void;
  setSimulationSpeed: (speedKey: SimulationSpeedKey) => void;
  stepSimulation: () => void;
  applyScenario: (scenarioKey: DemoScenarioKey) => void;
};

type ProductionSimulationContextValue = {
  snapshot: ProductionSnapshot;
  controls: ProductionSimulationControls;
  actions: ProductionSimulationActions;
};

const simulationSpeeds: Record<SimulationSpeedKey, number> = {
  slow: 6500,
  normal: 4000,
  fast: 1800,
};

const ProductionSimulationContext =
  createContext<ProductionSimulationContextValue | null>(null);

export function ProductionSimulationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const runtimeConfig = useMemo(() => getFrontendRuntimeConfig(), []);
  const localService = useMemo(() => createProductionService(), []);
  const remoteClient = useMemo(
    () =>
      runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote"
        ? createRemoteProductionClient()
        : null,
    [runtimeConfig],
  );
  const [snapshot, setSnapshot] = useState<ProductionSnapshot>(() =>
    createInitialProductionSnapshot(),
  );
  const [controls, setControls] = useState<ProductionSimulationControls>({
    mode: runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote" ? "remote" : "client",
    transport:
      runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote" ? "sse" : "timer",
    isPaused: false,
    speedKey: "normal",
    tickIntervalMs: simulationSpeeds.normal,
    connectionStatus:
      runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote" ? "connecting" : "local",
    startedAt: new Date().toISOString(),
    scenarioKey: createInitialProductionSnapshot().scenarioKey,
    scenarios: productionScenarioPresets,
    gatewayMode:
      runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote" ? "api" : "local",
  });
  const [fatalError, setFatalError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote" && remoteClient) {
      console.info("[production-sync] remote mode enabled");

      remoteClient
        .getBootstrap()
        .then((payload) => {
          if (!mounted) {
            return;
          }

          setSnapshot(payload.snapshot);
          setControls((current) => ({
            ...current,
            ...payload.runtime,
            scenarioKey: payload.snapshot.scenarioKey,
            scenarios: payload.scenarios,
            gatewayMode: "api",
            connectionStatus: "connecting",
          }));
        })
        .catch((error) => {
          console.error("[production-sync] bootstrap failed", error);
          if (!mounted) {
            return;
          }

          setFatalError(
            error instanceof Error
              ? error.message
              : "Failed to initialize remote production runtime.",
          );
        });

      return () => {
        mounted = false;
      };
    }

    console.info("[production-sync] client mode enabled");

    localService
      .bootstrap()
      .then((payload) => {
        if (!mounted) {
          return;
        }

        setSnapshot(payload.snapshot);
        setControls((current) => ({
          ...current,
          ...payload.runtime,
          scenarioKey: payload.snapshot.scenarioKey,
          scenarios: payload.scenarios,
          gatewayMode: "local",
        }));
      })
      .catch((error) => {
        console.error("[production-sync] local bootstrap failed", error);
        if (!mounted) {
          return;
        }

        setSnapshot(localService.getInitialSnapshot());
        setControls((current) => ({
          ...current,
          scenarios: productionScenarioPresets,
          gatewayMode: "local",
          connectionStatus: "local",
        }));
      });

    return () => {
      mounted = false;
    };
  }, [localService, remoteClient, runtimeConfig]);

  useEffect(() => {
    if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME !== "client") {
      return undefined;
    }

    if (controls.isPaused) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSnapshot((current) => {
        const nextSnapshot = localService.advance(current);
        setControls((currentControls) => ({
          ...currentControls,
          lastSyncAt: new Date().toISOString(),
          scenarioKey: nextSnapshot.scenarioKey,
        }));
        return nextSnapshot;
      });
    }, simulationSpeeds[controls.speedKey]);

    return () => window.clearInterval(interval);
  }, [
    controls.isPaused,
    controls.speedKey,
    localService,
    runtimeConfig.NEXT_PUBLIC_APP_RUNTIME,
  ]);

  useEffect(() => {
    if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME !== "remote" || !remoteClient) {
      return undefined;
    }

    const stopPolling = () => {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    const startPolling = (speedKey: SimulationSpeedKey) => {
      if (pollingRef.current !== null) {
        return;
      }

      const intervalMs = getFallbackPollingInterval(speedKey);
      pollingRef.current = window.setInterval(() => {
        void remoteClient
          .getSnapshot()
          .then((payload) => {
            setSnapshot(payload.snapshot);
            setControls((current) => ({
              ...current,
              ...payload.runtime,
              scenarioKey: payload.snapshot.scenarioKey,
              gatewayMode: "api",
              connectionStatus: "degraded",
            }));
          })
          .catch((error) => {
            setControls((current) => ({
              ...current,
              connectionStatus: "disconnected",
              lastError:
                error instanceof Error ? error.message : String(error),
            }));
          });
      }, intervalMs);
    };

    const unsubscribe = remoteClient.subscribe(
      (payload) => {
        stopPolling();
        setSnapshot(payload.snapshot);
        setControls((current) => ({
          ...current,
          ...payload.runtime,
          scenarioKey: payload.snapshot.scenarioKey,
          gatewayMode: "api",
          connectionStatus: "connected",
          lastError: undefined,
        }));
      },
      (status: ProductionConnectionStatus, error?: string) => {
        setControls((current) => ({
          ...current,
          connectionStatus: status,
          lastError: error ?? current.lastError,
          gatewayMode: "api",
        }));

        if (status === "connected") {
          stopPolling();
          return;
        }

        startPolling(controls.speedKey);
      },
    );

    return () => {
      stopPolling();
      unsubscribe();
    };
  }, [controls.speedKey, remoteClient, runtimeConfig.NEXT_PUBLIC_APP_RUNTIME]);

  const applyLocalSnapshot = useCallback(
    (updater: (snapshot: ProductionSnapshot) => ProductionSnapshot) => {
      setSnapshot((current) => {
        const nextSnapshot = updater(current);
        setControls((previous) => ({
          ...previous,
          scenarioKey: nextSnapshot.scenarioKey,
          lastSyncAt: new Date().toISOString(),
        }));
        return nextSnapshot;
      });
    },
    [],
  );

  const applyRemoteAction = useCallback(
    async <T extends keyof RemoteActionPayloadMap>(
      action: T,
      payload: RemoteActionPayloadMap[T],
    ) => {
      if (!remoteClient) {
        return;
      }

      const response = await remoteClient.sendAction(action, payload);
      setSnapshot(response.snapshot);
      setControls((current) => ({
        ...current,
        ...response.runtime,
        scenarioKey: response.snapshot.scenarioKey,
        gatewayMode: "api",
      }));
    },
    [remoteClient],
  );

  const startOrder = useCallback(
    (payload: StartOrderPayload) => {
      if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
        void applyRemoteAction("start-order", payload);
        return;
      }

      applyLocalSnapshot((current) => localService.startOrder(current, payload));
    },
    [applyLocalSnapshot, applyRemoteAction, localService, runtimeConfig],
  );

  const reportProduction = useCallback(
    (payload: ReportProductionPayload) => {
      if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
        void applyRemoteAction("report-production", payload);
        return;
      }

      applyLocalSnapshot((current) => localService.reportProduction(current, payload));
    },
    [applyLocalSnapshot, applyRemoteAction, localService, runtimeConfig],
  );

  const registerDowntime = useCallback(
    (payload: RegisterDowntimePayload) => {
      if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
        void applyRemoteAction("register-downtime", payload);
        return;
      }

      applyLocalSnapshot((current) => localService.registerDowntime(current, payload));
    },
    [applyLocalSnapshot, applyRemoteAction, localService, runtimeConfig],
  );

  const registerQuality = useCallback(
    (payload: RegisterQualityPayload) => {
      if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
        void applyRemoteAction("register-quality", payload);
        return;
      }

      applyLocalSnapshot((current) => localService.registerQuality(current, payload));
    },
    [applyLocalSnapshot, applyRemoteAction, localService, runtimeConfig],
  );

  const finalizeStage = useCallback(
    (payload: FinalizeStagePayload) => {
      if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
        void applyRemoteAction("finalize-stage", payload);
        return;
      }

      applyLocalSnapshot((current) => localService.finalizeStage(current, payload));
    },
    [applyLocalSnapshot, applyRemoteAction, localService, runtimeConfig],
  );

  const acknowledgeAlert = useCallback(
    (payload: { alertId: string; acknowledgedBy: string }) => {
      if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
        void applyRemoteAction("acknowledge-alert", payload);
        return;
      }

      applyLocalSnapshot((current) => localService.acknowledgeAlert(current, payload));
    },
    [applyLocalSnapshot, applyRemoteAction, localService, runtimeConfig],
  );

  const resetSimulation = useCallback(() => {
    if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
      void applyRemoteAction("reset", {});
      return;
    }

    setControls((current) => ({
      ...current,
      isPaused: false,
      speedKey: "normal",
      tickIntervalMs: simulationSpeeds.normal,
      scenarioKey: createInitialProductionSnapshot().scenarioKey,
    }));
    setSnapshot(localService.reset());
  }, [applyRemoteAction, localService, runtimeConfig]);

  const togglePaused = useCallback(() => {
    if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
      void applyRemoteAction("toggle-paused", {});
      return;
    }

    setControls((current) => ({
      ...current,
      isPaused: !current.isPaused,
    }));
  }, [applyRemoteAction, runtimeConfig]);

  const setSimulationSpeed = useCallback(
    (nextSpeedKey: SimulationSpeedKey) => {
      if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
        void applyRemoteAction("set-speed", { speedKey: nextSpeedKey });
        return;
      }

      setControls((current) => ({
        ...current,
        speedKey: nextSpeedKey,
        tickIntervalMs: simulationSpeeds[nextSpeedKey],
      }));
    },
    [applyRemoteAction, runtimeConfig],
  );

  const stepSimulation = useCallback(() => {
    if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
      void applyRemoteAction("step-simulation", {});
      return;
    }

    applyLocalSnapshot((current) => localService.advance(current));
  }, [applyLocalSnapshot, applyRemoteAction, localService, runtimeConfig]);

  const applyScenario = useCallback(
    (scenarioKey: DemoScenarioKey) => {
      if (runtimeConfig.NEXT_PUBLIC_APP_RUNTIME === "remote") {
        void applyRemoteAction("apply-scenario", { scenarioKey });
        return;
      }

      applyLocalSnapshot((current) => localService.applyScenario(current, scenarioKey));
    },
    [applyLocalSnapshot, applyRemoteAction, localService, runtimeConfig],
  );

  const contextValue = useMemo(
    () => ({
      snapshot,
      controls,
      actions: {
        startOrder,
        reportProduction,
        registerDowntime,
        registerQuality,
        finalizeStage,
        acknowledgeAlert,
        resetSimulation,
        togglePaused,
        setSimulationSpeed,
        stepSimulation,
        applyScenario,
      },
    }),
    [
      acknowledgeAlert,
      applyScenario,
      controls,
      finalizeStage,
      registerDowntime,
      registerQuality,
      reportProduction,
      resetSimulation,
      setSimulationSpeed,
      snapshot,
      startOrder,
      stepSimulation,
      togglePaused,
    ],
  );

  if (fatalError) {
    return (
      <div className="min-h-screen bg-[#07131d] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-red-500/30 bg-red-500/10 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-300">
            Runtime failure
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            Falha ao iniciar a sincronizacao de producao
          </h1>
          <p className="mt-3 text-sm leading-7 text-red-100/85">{fatalError}</p>
        </div>
      </div>
    );
  }

  return (
    <ProductionSimulationContext.Provider value={contextValue}>
      {children}
    </ProductionSimulationContext.Provider>
  );
}

export function useProductionSimulation() {
  const context = useContext(ProductionSimulationContext);

  if (!context) {
    throw new Error(
      "useProductionSimulation must be used within ProductionSimulationProvider.",
    );
  }

  return context.snapshot;
}

export function useProductionSimulationActions() {
  const context = useContext(ProductionSimulationContext);

  if (!context) {
    throw new Error(
      "useProductionSimulationActions must be used within ProductionSimulationProvider.",
    );
  }

  return context.actions;
}

export function useProductionSimulationControls() {
  const context = useContext(ProductionSimulationContext);

  if (!context) {
    throw new Error(
      "useProductionSimulationControls must be used within ProductionSimulationProvider.",
    );
  }

  return context.controls;
}

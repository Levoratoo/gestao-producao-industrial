import type {
  ProductionScenarioPreset,
  SimulationSpeedKey,
  StartOrderPayload,
  ReportProductionPayload,
  RegisterDowntimePayload,
  RegisterQualityPayload,
  FinalizeStagePayload,
  ProductionSnapshot,
} from "../../domain/production/types";

export type ProductionGatewayMode = "local" | "api";
export type ProductionRuntimeMode = "client" | "remote";
export type ProductionConnectionStatus =
  | "local"
  | "connecting"
  | "connected"
  | "degraded"
  | "disconnected";

export interface ProductionRuntimeState {
  mode: ProductionRuntimeMode;
  transport: "timer" | "sse";
  isPaused: boolean;
  speedKey: SimulationSpeedKey;
  tickIntervalMs: number;
  connectionStatus: ProductionConnectionStatus;
  startedAt: string;
  lastSyncAt?: string;
  lastError?: string;
}

export interface ProductionBootstrapResponse {
  snapshot: ProductionSnapshot;
  scenarios: ProductionScenarioPreset[];
  runtime: ProductionRuntimeState;
  capabilities: {
    mutations: "client" | "api";
    reports: "client" | "api";
    runtimeApiAvailable: boolean;
  };
}

export interface ProductionSnapshotResponse {
  snapshot: ProductionSnapshot;
  runtime: ProductionRuntimeState;
}

export type ProductionActionResponse = ProductionSnapshotResponse;

export interface ProductionHealthResponse {
  status: "ok" | "degraded" | "error";
  service: string;
  environment: string;
  version: string;
  timestamp: string;
  database: {
    status: "connected" | "disconnected";
    latencyMs?: number;
    error?: string;
  };
  runtime: ProductionRuntimeState & {
    tick: number;
  };
}

export type RemoteActionPayloadMap = {
  "start-order": StartOrderPayload;
  "report-production": ReportProductionPayload;
  "register-downtime": RegisterDowntimePayload;
  "register-quality": RegisterQualityPayload;
  "finalize-stage": FinalizeStagePayload;
  "acknowledge-alert": {
    alertId: string;
    acknowledgedBy: string;
  };
  "apply-scenario": {
    scenarioKey: ProductionSnapshot["scenarioKey"];
  };
  reset: Record<string, never>;
  "toggle-paused": Record<string, never>;
  "step-simulation": Record<string, never>;
  "set-speed": {
    speedKey: SimulationSpeedKey;
  };
};

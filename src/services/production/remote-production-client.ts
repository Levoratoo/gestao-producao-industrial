import { normalizeProductionSnapshot } from "@/domain/production/state";
import type { SimulationSpeedKey } from "@/domain/production/types";
import { getFrontendRuntimeConfig } from "@/config/runtime-config";
import type {
  ProductionActionResponse,
  ProductionBootstrapResponse,
  ProductionConnectionStatus,
  ProductionHealthResponse,
  ProductionSnapshotResponse,
  RemoteActionPayloadMap,
} from "@/services/production/contracts";

export function createRemoteProductionClient() {
  const runtimeConfig = getFrontendRuntimeConfig();

  return {
    async getBootstrap() {
      const response = await fetchJson<ProductionBootstrapResponse>(
        `${runtimeConfig.apiBaseUrl}/api/production/bootstrap`,
      );

      return {
        ...response,
        snapshot: normalizeProductionSnapshot(response.snapshot),
      };
    },
    async getSnapshot() {
      const response = await fetchJson<ProductionSnapshotResponse>(
        `${runtimeConfig.apiBaseUrl}/api/production/snapshot`,
      );

      return {
        ...response,
        snapshot: normalizeProductionSnapshot(response.snapshot),
      };
    },
    async getHealth() {
      return fetchJson<ProductionHealthResponse>(runtimeConfig.healthUrl);
    },
    subscribe(
      onMessage: (payload: ProductionSnapshotResponse) => void,
      onStatusChange: (status: ProductionConnectionStatus, error?: string) => void,
    ) {
      const eventSource = new EventSource(runtimeConfig.sseUrl);

      eventSource.onopen = () => {
        onStatusChange("connected");
      };

      eventSource.onmessage = (event) => {
        const payload = JSON.parse(event.data) as ProductionSnapshotResponse;
        onMessage({
          ...payload,
          snapshot: normalizeProductionSnapshot(payload.snapshot),
        });
      };

      eventSource.onerror = () => {
        onStatusChange("degraded", "SSE disconnected. Falling back to polling.");
      };

      onStatusChange("connecting");

      return () => {
        eventSource.close();
      };
    },
    async sendAction<K extends keyof RemoteActionPayloadMap>(
      action: K,
      payload: RemoteActionPayloadMap[K],
    ) {
      const response = await fetchJson<ProductionActionResponse>(
        `${runtimeConfig.apiBaseUrl}/api/production/actions/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      return {
        ...response,
        snapshot: normalizeProductionSnapshot(response.snapshot),
      };
    },
  };
}

async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${input}`);
  }

  return (await response.json()) as T;
}

export function getFallbackPollingInterval(speedKey: SimulationSpeedKey) {
  if (speedKey === "fast") {
    return 2500;
  }

  if (speedKey === "slow") {
    return 8000;
  }

  return 5000;
}

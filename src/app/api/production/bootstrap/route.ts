import { NextResponse } from "next/server";
import { createInitialProductionSnapshot } from "@/domain/production/mock-data";
import { productionScenarioPresets } from "@/domain/production/scenarios";
import { normalizeProductionSnapshot } from "@/domain/production/state";
import type { ProductionBootstrapResponse } from "@/services/production/contracts";

export const dynamic = "force-static";

export async function GET() {
  const payload: ProductionBootstrapResponse = {
    snapshot: normalizeProductionSnapshot(createInitialProductionSnapshot()),
    scenarios: productionScenarioPresets,
    runtime: {
      mode: "client",
      transport: "timer",
      isPaused: false,
      speedKey: "normal",
      tickIntervalMs: 4000,
      connectionStatus: "local",
      startedAt: new Date().toISOString(),
      lastSyncAt: createInitialProductionSnapshot().currentTime,
    },
    capabilities: {
      mutations: "client",
      reports: "client",
      runtimeApiAvailable: false,
    },
  };

  return NextResponse.json(payload);
}

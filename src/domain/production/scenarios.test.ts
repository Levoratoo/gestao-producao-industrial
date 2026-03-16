import { describe, expect, it } from "vitest";
import { createInitialProductionSnapshot } from "@/domain/production/mock-data";
import { applyScenarioPreset } from "@/domain/production/scenarios";

describe("demo scenarios", () => {
  it("applies the costura bottleneck preset with coherent sector degradation", () => {
    const snapshot = createInitialProductionSnapshot();
    const nextSnapshot = applyScenarioPreset(snapshot, "gargalo_costura");
    const costura = nextSnapshot.sectors.find((sector) => sector.key === "costura");

    expect(nextSnapshot.scenarioKey).toBe("gargalo_costura");
    expect(costura?.status).toBe("atencao");
    expect(costura?.efficiency).toBe(74);
    expect(nextSnapshot.alerts.some((alert) => alert.sector === "costura")).toBe(true);
  });
});

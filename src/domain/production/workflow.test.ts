import { describe, expect, it } from "vitest";
import { createInitialProductionSnapshot } from "./mock-data";
import { advanceProductionSimulation } from "./simulator";

describe("workflow derivation", () => {
  it("builds an end-to-end process pipeline for every order", () => {
    const snapshot = createInitialProductionSnapshot();

    expect(snapshot.processStages).toHaveLength(7);
    expect(snapshot.orderFlows).toHaveLength(snapshot.orders.length);
    expect(snapshot.orderFlows[0]?.stages).toHaveLength(7);
    expect(snapshot.shipmentManifests.length).toBeGreaterThan(0);
  });

  it("keeps workflow data synchronized after simulation ticks", () => {
    const snapshot = createInitialProductionSnapshot();
    const nextSnapshot = advanceProductionSimulation(snapshot);

    expect(nextSnapshot.orderFlows).toHaveLength(nextSnapshot.orders.length);
    expect(nextSnapshot.processStages.find((stage) => stage.key === "faturamento")).toBeTruthy();
    expect(nextSnapshot.shipmentManifests.every((manifest) => manifest.updatedAt === nextSnapshot.currentTime)).toBe(true);
  });
});


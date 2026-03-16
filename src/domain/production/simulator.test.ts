import { describe, expect, it } from "vitest";
import { createInitialProductionSnapshot } from "@/domain/production/mock-data";
import { advanceProductionSimulation } from "@/domain/production/simulator";

describe("production simulator", () => {
  it("advances the industrial snapshot with controlled time and alert metadata", () => {
    const snapshot = createInitialProductionSnapshot();
    const nextSnapshot = advanceProductionSimulation(snapshot);

    expect(nextSnapshot.tick).toBe(1);
    expect(
      new Date(nextSnapshot.currentTime).getTime() -
        new Date(snapshot.currentTime).getTime(),
    ).toBe(5 * 60 * 1000);
    expect(nextSnapshot.orders.some((order) => order.lastUpdate === nextSnapshot.currentTime)).toBe(true);
    expect(nextSnapshot.alerts.every((alert) => Boolean(alert.fingerprint))).toBe(true);
    expect(nextSnapshot.alerts.every((alert) => alert.source === "simulation")).toBe(true);
  });
});

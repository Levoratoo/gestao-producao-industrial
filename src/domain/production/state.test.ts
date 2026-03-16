import { describe, expect, it } from "vitest";
import { createInitialProductionSnapshot } from "@/domain/production/mock-data";
import {
  acknowledgeProductionAlert,
  reconcileAlertTimeline,
} from "@/domain/production/state";

describe("production alert timeline", () => {
  it("suppresses an acknowledged alert until the condition clears", () => {
    const snapshot = createInitialProductionSnapshot();
    const acknowledged = acknowledgeProductionAlert(
      snapshot,
      "alt-02",
      "Ana Claudia",
    );
    const repeatedCondition = reconcileAlertTimeline(acknowledged, {
      ...acknowledged,
      alerts: snapshot.alerts,
    });

    expect(
      repeatedCondition.alerts.some(
        (alert) => alert.fingerprint === "supply-op-240316-05",
      ),
    ).toBe(false);
    expect(
      repeatedCondition.alertHistory.find(
        (alert) => alert.fingerprint === "supply-op-240316-05",
      )?.acknowledgedBy,
    ).toBe("Ana Claudia");
  });

  it("marks acknowledged alerts as resolved once they stop reappearing", () => {
    const snapshot = createInitialProductionSnapshot();
    const acknowledged = acknowledgeProductionAlert(
      snapshot,
      "alt-02",
      "Ana Claudia",
    );
    const nextTime = new Date(acknowledged.currentTime);
    nextTime.setMinutes(nextTime.getMinutes() + 5);

    const resolved = reconcileAlertTimeline(acknowledged, {
      ...acknowledged,
      currentTime: nextTime.toISOString(),
      alerts: acknowledged.alerts,
    });

    expect(
      resolved.alertHistory.find(
        (alert) => alert.fingerprint === "supply-op-240316-05",
      )?.resolvedAt,
    ).toBe(nextTime.toISOString());
  });
});

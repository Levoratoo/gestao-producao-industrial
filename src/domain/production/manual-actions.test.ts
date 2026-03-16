import { describe, expect, it } from "vitest";
import { createInitialProductionSnapshot } from "@/domain/production/mock-data";
import {
  applyManualDowntimeRegistration,
  applyManualProductionReport,
} from "@/domain/production/manual-actions";

describe("manual production actions", () => {
  it("records manual production on the selected order and creates a feed entry", () => {
    const snapshot = createInitialProductionSnapshot();
    const nextSnapshot = applyManualProductionReport(snapshot, {
      orderId: "ord-01",
      operatorId: "op-03",
      quantity: 120,
      note: "Lote intermediario consolidado.",
    });
    const updatedOrder = nextSnapshot.orders.find((order) => order.id === "ord-01");

    expect(updatedOrder?.producedQuantity).toBe(2000);
    expect(nextSnapshot.manualEntries[0]?.action).toBe("apontar_producao");
    expect(nextSnapshot.manualEntries[0]?.quantity).toBe(120);
    expect(
      nextSnapshot.hourlyProduction.some(
        (point) => point.label === "14:20" && point.produced === 120,
      ),
    ).toBe(true);
  });

  it("registers downtime as a manual alert and pauses the order", () => {
    const snapshot = createInitialProductionSnapshot();
    const nextSnapshot = applyManualDowntimeRegistration(snapshot, {
      orderId: "ord-05",
      operatorId: "op-01",
      durationMinutes: 24,
      reason: "Ajuste de maquina",
      note: "Troca de componente no posto.",
    });
    const stoppedOrder = nextSnapshot.orders.find((order) => order.id === "ord-05");
    const manualAlert = nextSnapshot.alerts.find(
      (alert) => alert.fingerprint === "manual-stop-op-240316-05",
    );

    expect(stoppedOrder?.status).toBe("parada");
    expect(manualAlert?.source).toBe("manual");
    expect(manualAlert?.severity).toBe("high");
  });
});

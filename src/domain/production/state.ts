import { createInitialProductionSnapshot } from "./mock-data";
import type {
  ProductionAlert,
  ProductionSnapshot,
  ProductionSector,
  SectorKey,
} from "./types";

const alertHistoryLimit = 32;

export function normalizeProductionSnapshot(
  snapshot?: ProductionSnapshot | null,
): ProductionSnapshot {
  const base = createInitialProductionSnapshot();

  if (!snapshot) {
    return withAlertCounts(base);
  }

  return withAlertCounts({
    ...base,
    ...snapshot,
    products: mergeCollection(base.products, snapshot.products, "id"),
    operators: mergeCollection(base.operators, snapshot.operators, "id"),
    sectors: mergeCollection(base.sectors, snapshot.sectors, "key"),
    orders: mergeCollection(base.orders, snapshot.orders, "id"),
    lines: mergeCollection(base.lines, snapshot.lines, "id"),
    machines: mergeCollection(base.machines, snapshot.machines, "id"),
    alerts: (snapshot.alerts ?? base.alerts).map((alert) =>
      normalizeAlert(alert, true),
    ),
    alertHistory: (snapshot.alertHistory ?? base.alertHistory).map((alert) =>
      normalizeAlert(alert, false),
    ),
    hourlyProduction: snapshot.hourlyProduction ?? base.hourlyProduction,
    manualEntries: snapshot.manualEntries ?? base.manualEntries,
  });
}

export function reconcileAlertTimeline(
  previousSnapshot: ProductionSnapshot,
  nextSnapshot: ProductionSnapshot,
) {
  const previous = normalizeProductionSnapshot(previousSnapshot);
  const next = normalizeProductionSnapshot(nextSnapshot);

  const previousActiveAlerts = new Map(
    previous.alerts.map((alert) => [alert.fingerprint, alert]),
  );
  const incomingAlerts = new Map(
    next.alerts.map((alert) => [alert.fingerprint, alert]),
  );

  let nextHistory = [...previous.alertHistory];
  const suppressedFingerprints = new Set(
    nextHistory
      .filter((alert) => alert.acknowledgedAt && !alert.resolvedAt)
      .map((alert) => alert.fingerprint),
  );

  nextHistory = nextHistory.map((alert) => {
    if (
      suppressedFingerprints.has(alert.fingerprint) &&
      !incomingAlerts.has(alert.fingerprint) &&
      !alert.resolvedAt
    ) {
      return {
        ...alert,
        resolvedAt: next.currentTime,
      };
    }

    return alert;
  });

  const activeAlerts = next.alerts.flatMap((alert) => {
    if (suppressedFingerprints.has(alert.fingerprint)) {
      return [];
    }

    const previousAlert = previousActiveAlerts.get(alert.fingerprint);

    if (!previousAlert) {
      return [alert];
    }

    return [
      {
        ...alert,
        id: previousAlert.id,
        timestamp: previousAlert.timestamp,
      },
    ];
  });

  const resolvedAlerts = previous.alerts
    .filter((alert) => !incomingAlerts.has(alert.fingerprint))
    .map((alert) => ({
      ...alert,
      active: false,
      resolvedAt: alert.resolvedAt ?? next.currentTime,
    }));

  const historyById = new Map<string, ProductionAlert>();

  [...resolvedAlerts, ...nextHistory]
    .sort(compareAlertsByRecentActivity)
    .forEach((alert) => {
      if (!historyById.has(alert.id)) {
        historyById.set(alert.id, {
          ...alert,
          active: false,
        });
      }
    });

  return withAlertCounts({
    ...next,
    alerts: activeAlerts,
    alertHistory: [...historyById.values()].slice(0, alertHistoryLimit),
  });
}

export function acknowledgeProductionAlert(
  snapshot: ProductionSnapshot,
  alertId: string,
  acknowledgedBy: string,
) {
  const normalizedSnapshot = normalizeProductionSnapshot(snapshot);
  const alert = normalizedSnapshot.alerts.find((item) => item.id === alertId);

  if (!alert) {
    return normalizedSnapshot;
  }

  const nextAlertHistory = [
    {
      ...alert,
      active: false,
      acknowledgedAt: normalizedSnapshot.currentTime,
      acknowledgedBy,
    },
    ...normalizedSnapshot.alertHistory.filter((item) => item.id !== alert.id),
  ]
    .sort(compareAlertsByRecentActivity)
    .slice(0, alertHistoryLimit);

  return withAlertCounts({
    ...normalizedSnapshot,
    alerts: normalizedSnapshot.alerts.filter((item) => item.id !== alert.id),
    alertHistory: nextAlertHistory,
  });
}

function withAlertCounts(snapshot: ProductionSnapshot): ProductionSnapshot {
  return {
    ...snapshot,
    sectors: applyAlertCounts(snapshot.sectors, snapshot.alerts),
  };
}

function applyAlertCounts(
  sectors: ProductionSector[],
  alerts: ProductionAlert[],
) {
  const counts = alerts.reduce<Record<SectorKey | "fabrica", number>>(
    (accumulator, alert) => {
      accumulator[alert.sector] = (accumulator[alert.sector] ?? 0) + 1;
      return accumulator;
    },
    {
      fabrica: 0,
      corte: 0,
      costura: 0,
      acabamento: 0,
      expedicao: 0,
    },
  );

  return sectors.map((sector) => ({
    ...sector,
    alertCount: counts[sector.key] ?? 0,
  }));
}

function mergeCollection<T, K extends keyof T>(
  baseItems: T[],
  currentItems: T[] | undefined,
  key: K,
): T[] {
  if (!currentItems || currentItems.length === 0) {
    return baseItems;
  }

  const baseMap = new Map<string, T>(
    baseItems.map((item) => [String(item[key]), item]),
  );
  const merged: T[] = currentItems.map((item) => {
    const baseItem = baseMap.get(String(item[key]));
    return baseItem ? { ...baseItem, ...item } : item;
  });
  const knownKeys = new Set(merged.map((item) => String(item[key])));
  const missingBaseItems = baseItems.filter(
    (item) => !knownKeys.has(String(item[key])),
  );

  return [...merged, ...missingBaseItems];
}

function normalizeAlert(
  alert: ProductionAlert,
  active: boolean,
): ProductionAlert {
  return {
    ...alert,
    fingerprint: alert.fingerprint ?? deriveAlertFingerprint(alert),
    source: alert.source ?? "simulation",
    active,
  };
}

function deriveAlertFingerprint(alert: ProductionAlert) {
  return [alert.type, alert.sector, alert.orderNumber ?? "fabrica", alert.title]
    .join(":")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function compareAlertsByRecentActivity(
  left: ProductionAlert,
  right: ProductionAlert,
) {
  const leftTimestamp =
    left.resolvedAt ?? left.acknowledgedAt ?? left.timestamp;
  const rightTimestamp =
    right.resolvedAt ?? right.acknowledgedAt ?? right.timestamp;

  return (
    new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime()
  );
}

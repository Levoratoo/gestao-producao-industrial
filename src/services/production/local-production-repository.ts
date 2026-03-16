import { createInitialProductionSnapshot } from "@/domain/production/mock-data";
import { normalizeProductionSnapshot } from "@/domain/production/state";
import type { ProductionSnapshot } from "@/domain/production/types";

const storageKey = "rosa-maria.production.snapshot.v1";

export interface ProductionRepository {
  hasSnapshot: () => boolean;
  load: () => ProductionSnapshot;
  save: (snapshot: ProductionSnapshot) => void;
  clear: () => void;
}

export function createLocalProductionRepository(): ProductionRepository {
  return {
    hasSnapshot() {
      if (!isBrowserEnvironment()) {
        return false;
      }

      return window.localStorage.getItem(storageKey) !== null;
    },
    load() {
      if (!isBrowserEnvironment()) {
        return normalizeProductionSnapshot(createInitialProductionSnapshot());
      }

      try {
        const rawSnapshot = window.localStorage.getItem(storageKey);

        if (!rawSnapshot) {
          return normalizeProductionSnapshot(createInitialProductionSnapshot());
        }

        return normalizeProductionSnapshot(
          JSON.parse(rawSnapshot) as ProductionSnapshot,
        );
      } catch {
        return normalizeProductionSnapshot(createInitialProductionSnapshot());
      }
    },
    save(snapshot) {
      if (!isBrowserEnvironment()) {
        return;
      }

      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    },
    clear() {
      if (!isBrowserEnvironment()) {
        return;
      }

      window.localStorage.removeItem(storageKey);
    },
  };
}

function isBrowserEnvironment() {
  return typeof window !== "undefined";
}

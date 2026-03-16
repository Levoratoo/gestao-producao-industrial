import type { Pool } from "pg";
import { createInitialProductionSnapshot } from "../../../src/domain/production/mock-data.js";
import { normalizeProductionSnapshot } from "../../../src/domain/production/state.js";
import type { ProductionSnapshot } from "../../../src/domain/production/types.js";
import type { ProductionRuntimeState } from "../../../src/services/production/contracts.js";

const runtimeStateId = "primary";

export type PersistedProductionState = {
  snapshot: ProductionSnapshot;
  runtime: ProductionRuntimeState;
};

export function createProductionStateRepository(pool: Pool) {
  return {
    async load(): Promise<PersistedProductionState | null> {
      const result = await pool.query<{
        snapshot: ProductionSnapshot;
        runtime: ProductionRuntimeState;
      }>(
        `
          SELECT snapshot, runtime
          FROM production_runtime_state
          WHERE id = $1
        `,
        [runtimeStateId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        snapshot: normalizeProductionSnapshot(row.snapshot),
        runtime: row.runtime,
      };
    },
    async save(state: PersistedProductionState) {
      await pool.query(
        `
          INSERT INTO production_runtime_state (id, snapshot, runtime, updated_at)
          VALUES ($1, $2::jsonb, $3::jsonb, NOW())
          ON CONFLICT (id)
          DO UPDATE
          SET snapshot = EXCLUDED.snapshot,
              runtime = EXCLUDED.runtime,
              updated_at = NOW()
        `,
        [runtimeStateId, JSON.stringify(state.snapshot), JSON.stringify(state.runtime)],
      );
    },
    async appendEvent(eventType: string, payload: Record<string, unknown>) {
      await pool.query(
        `
          INSERT INTO production_runtime_events (event_type, payload)
          VALUES ($1, $2::jsonb)
        `,
        [eventType, JSON.stringify(payload)],
      );
    },
    createDefaultRuntimeState(): ProductionRuntimeState {
      return {
        mode: "remote",
        transport: "sse",
        isPaused: false,
        speedKey: "normal",
        tickIntervalMs: 4000,
        connectionStatus: "connected",
        startedAt: new Date().toISOString(),
        lastSyncAt: createInitialProductionSnapshot().currentTime,
      };
    },
  };
}

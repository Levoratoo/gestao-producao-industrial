import { Pool } from "pg";
import type { BackendEnv } from "../config/env.js";

type Logger = {
  info: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
};

export async function createDatabase(env: BackendEnv, logger: Logger) {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  });

  const startedAt = Date.now();

  try {
    await pool.query("SELECT 1");
    logger.info("database connected", {
      latencyMs: Date.now() - startedAt,
    });
    await ensureSchema(pool);
  } catch (error) {
    logger.error("database connection failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  return {
    pool,
    async healthcheck() {
      const pingStartedAt = Date.now();

      try {
        await pool.query("SELECT 1");
        return {
          status: "connected" as const,
          latencyMs: Date.now() - pingStartedAt,
        };
      } catch (error) {
        return {
          status: "disconnected" as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async close() {
      await pool.end();
    },
  };
}

async function ensureSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS production_runtime_state (
      id TEXT PRIMARY KEY,
      snapshot JSONB NOT NULL,
      runtime JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS production_runtime_events (
      id BIGSERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

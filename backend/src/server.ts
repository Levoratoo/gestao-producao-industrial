import cors from "cors";
import express from "express";
import { backendEnv } from "./config/env.js";
import { createDatabase } from "./db/database.js";
import { createLogger } from "./lib/logger.js";
import { createProductionRoutes } from "./routes/production-routes.js";
import { createProductionRuntimeService } from "./services/production-runtime-service.js";

const logger = createLogger(backendEnv.LOG_LEVEL);

async function main() {
  const database = await createDatabase(backendEnv, logger);
  const runtimeService = createProductionRuntimeService({
    env: backendEnv,
    pool: database.pool,
    logger,
    databaseHealthcheck: database.healthcheck,
  });

  await runtimeService.initialize();
  await runtimeService.start();

  const app = express();

  app.use(
    cors({
      origin: backendEnv.corsAllowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.use("/api", createProductionRoutes(runtimeService));

  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    void next;
    const message = error instanceof Error ? error.message : "Unhandled server error.";
    logger.error("request failed", { error: message });
    response.status(500).json({
      status: "error",
      message,
    });
  });

  const server = app.listen(backendEnv.PORT, () => {
    logger.info("server started", {
      port: backendEnv.PORT,
      nodeEnv: backendEnv.NODE_ENV,
      frontendUrl: backendEnv.FRONTEND_URL,
      syncIntervalMs: backendEnv.SYNC_INTERVAL_MS,
    });
  });

  const shutdown = async () => {
    logger.info("shutdown requested");
    runtimeService.stop();
    server.close(async () => {
      await database.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error) => {
  logger.error("backend startup failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

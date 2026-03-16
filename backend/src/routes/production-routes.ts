import { Router } from "express";
import type { Request, Response } from "express";
import type { createProductionRuntimeService } from "../services/production-runtime-service.js";

type RuntimeService = ReturnType<typeof createProductionRuntimeService>;

export function createProductionRoutes(runtimeService: RuntimeService) {
  const router = Router();

  router.get("/health", async (_request, response, next) => {
    try {
      response.json(await runtimeService.getHealthResponse());
    } catch (error) {
      next(error);
    }
  });

  router.get("/production/bootstrap", (_request, response) => {
    response.json(runtimeService.getBootstrapResponse());
  });

  router.get("/production/snapshot", (_request, response) => {
    response.json(runtimeService.getSnapshotResponse());
  });

  router.get("/production/stream", (request, response) => {
    configureSse(response);
    response.write("retry: 3000\n\n");

    const unsubscribe = runtimeService.subscribe((payload) => {
      response.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      response.write(": keep-alive\n\n");
    }, 15000);

    request.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
    });
  });

  router.post("/production/actions/start-order", createJsonHandler(async (request) =>
    runtimeService.startOrder(request.body),
  ));
  router.post("/production/actions/report-production", createJsonHandler(async (request) =>
    runtimeService.reportProduction(request.body),
  ));
  router.post("/production/actions/register-downtime", createJsonHandler(async (request) =>
    runtimeService.registerDowntime(request.body),
  ));
  router.post("/production/actions/register-quality", createJsonHandler(async (request) =>
    runtimeService.registerQuality(request.body),
  ));
  router.post("/production/actions/finalize-stage", createJsonHandler(async (request) =>
    runtimeService.finalizeStage(request.body),
  ));
  router.post("/production/actions/acknowledge-alert", createJsonHandler(async (request) =>
    runtimeService.acknowledgeAlert(request.body),
  ));
  router.post("/production/actions/apply-scenario", createJsonHandler(async (request) =>
    runtimeService.applyScenario(request.body),
  ));
  router.post("/production/actions/reset", createJsonHandler(async () =>
    runtimeService.reset(),
  ));
  router.post("/production/actions/toggle-paused", createJsonHandler(async () =>
    runtimeService.togglePaused(),
  ));
  router.post("/production/actions/step-simulation", createJsonHandler(async () =>
    runtimeService.stepSimulation(),
  ));
  router.post("/production/actions/set-speed", createJsonHandler(async (request) =>
    runtimeService.setSpeed(request.body),
  ));

  return router;
}

function createJsonHandler<T>(
  handler: (request: Request) => Promise<T>,
) {
  return async (request: Request, response: Response, next: (error?: unknown) => void) => {
    try {
      response.json(await handler(request));
    } catch (error) {
      next(error);
    }
  };
}

function configureSse(response: Response) {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();
}

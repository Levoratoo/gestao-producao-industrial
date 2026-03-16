const baseUrl = process.env.API_URL;
const waitMs = Number(process.env.VERIFY_WAIT_MS ?? "6500");

if (!baseUrl) {
  throw new Error("API_URL is required. Example: API_URL=https://api.example.com");
}

if (!Number.isFinite(waitMs) || waitMs < 1500) {
  throw new Error("VERIFY_WAIT_MS must be a number greater than or equal to 1500.");
}

async function main() {
  const healthResponse = await fetch(`${baseUrl}/api/health`);

  if (!healthResponse.ok) {
    throw new Error(`Healthcheck failed with status ${healthResponse.status}.`);
  }

  const healthPayload = (await healthResponse.json()) as {
    database: { status: string };
    runtime: { isPaused: boolean; tick: number };
    status: string;
  };

  if (healthPayload.status === "error" || healthPayload.database.status !== "connected") {
    throw new Error(
      `Healthcheck returned database=${healthPayload.database.status} status=${healthPayload.status}.`,
    );
  }

  if (healthPayload.runtime.isPaused) {
    throw new Error(
      "Automatic order update runtime is paused. Resume it before running verify-sync.",
    );
  }

  const initialSnapshotResponse = await fetch(`${baseUrl}/api/production/snapshot`);
  const initialPayload = (await initialSnapshotResponse.json()) as {
    snapshot: { tick: number };
    runtime: { isPaused: boolean };
  };

  console.log(
    `[verify-sync] health ok database=${healthPayload.database.status} initial tick=${initialPayload.snapshot.tick} paused=${initialPayload.runtime.isPaused}`,
  );

  await new Promise((resolve) => setTimeout(resolve, waitMs));

  const finalSnapshotResponse = await fetch(`${baseUrl}/api/production/snapshot`);
  const finalPayload = (await finalSnapshotResponse.json()) as {
    snapshot: { tick: number };
  };

  if (finalPayload.snapshot.tick <= initialPayload.snapshot.tick) {
    throw new Error(
      `Automatic order update is not advancing. tick remained at ${finalPayload.snapshot.tick}.`,
    );
  }

  console.log(
    `[verify-sync] ok tick ${initialPayload.snapshot.tick} -> ${finalPayload.snapshot.tick}`,
  );
}

main().catch((error) => {
  console.error(
    `[verify-sync] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});

import { spawnSync } from "node:child_process";

const command = process.argv[2];
const port = process.env.FRONTEND_PORT ?? process.env.PORT ?? "3013";

if (!command || !["dev", "build", "start"].includes(command)) {
  console.error("[run-next] invalid command. Use dev, build or start.");
  process.exit(1);
}

const prepare = spawnSync(
  process.execPath,
  ["scripts/generate-runtime-config.mjs"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

if (prepare.status !== 0) {
  process.exit(prepare.status ?? 1);
}

const nextArgs =
  command === "build" ? ["next", "build"] : ["next", command, "--port", port];

const result = spawnSync("npx", nextArgs, {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);

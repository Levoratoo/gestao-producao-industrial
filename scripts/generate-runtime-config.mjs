import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .default("")
  .superRefine((value, context) => {
    if (!value) {
      return;
    }

    try {
      new URL(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a valid URL.",
      });
    }
  });

const runtimeConfigSchema = z
  .object({
    NEXT_PUBLIC_APP_RUNTIME: z.enum(["client", "remote"]).default("client"),
    NEXT_PUBLIC_API_URL: optionalUrl,
    NEXT_PUBLIC_SSE_URL: optionalUrl,
    NEXT_PUBLIC_FRONTEND_URL: optionalUrl,
    NEXT_PUBLIC_SYNC_TRANSPORT: z
      .enum(["auto", "timer", "sse"])
      .default("auto"),
    NEXT_PUBLIC_HEALTH_URL: optionalUrl,
    STATIC_EXPORT: z.string().optional().default("false"),
    GITHUB_PAGES: z.string().optional().default("false"),
  })
  .superRefine((value, context) => {
    if (value.NEXT_PUBLIC_APP_RUNTIME === "remote" && !value.NEXT_PUBLIC_API_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "NEXT_PUBLIC_API_URL is required when NEXT_PUBLIC_APP_RUNTIME=remote.",
        path: ["NEXT_PUBLIC_API_URL"],
      });
    }
  });

const publicDir = path.resolve(process.cwd(), "public");
const runtimeConfigPath = path.join(publicDir, "runtime-config.js");
const healthPath = path.join(publicDir, "health.json");

fs.mkdirSync(publicDir, { recursive: true });

const parsedConfig = runtimeConfigSchema.safeParse(process.env);

if (!parsedConfig.success) {
  const issues = parsedConfig.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`[runtime-config] invalid environment: ${issues}`);
}

const runtimeConfig = {
  NEXT_PUBLIC_APP_RUNTIME: parsedConfig.data.NEXT_PUBLIC_APP_RUNTIME,
  NEXT_PUBLIC_API_URL: parsedConfig.data.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SSE_URL: parsedConfig.data.NEXT_PUBLIC_SSE_URL,
  NEXT_PUBLIC_FRONTEND_URL: parsedConfig.data.NEXT_PUBLIC_FRONTEND_URL,
  NEXT_PUBLIC_SYNC_TRANSPORT: parsedConfig.data.NEXT_PUBLIC_SYNC_TRANSPORT,
  NEXT_PUBLIC_HEALTH_URL: parsedConfig.data.NEXT_PUBLIC_HEALTH_URL,
  BUILD_TARGET:
    parsedConfig.data.STATIC_EXPORT === "true" ||
    parsedConfig.data.GITHUB_PAGES === "true"
      ? "static"
      : "server",
  GENERATED_AT: new Date().toISOString(),
};

const runtimeScript = `window.__INDUSTRIAL_RUNTIME_CONFIG__ = ${JSON.stringify(
  runtimeConfig,
  null,
  2,
)};\n`;

fs.writeFileSync(runtimeConfigPath, runtimeScript, "utf8");
fs.writeFileSync(
  healthPath,
  JSON.stringify(
    {
      status: "ok",
      service: "frontend-static-runtime",
      mode: runtimeConfig.NEXT_PUBLIC_APP_RUNTIME,
      buildTarget: runtimeConfig.BUILD_TARGET,
      generatedAt: runtimeConfig.GENERATED_AT,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(
  `[runtime-config] generated public/runtime-config.js (${runtimeConfig.NEXT_PUBLIC_APP_RUNTIME})`,
);

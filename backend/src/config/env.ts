import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const environmentCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend/.env"),
  path.resolve(moduleDirectory, "../../../.env"),
  path.resolve(moduleDirectory, "../../.env"),
];

environmentCandidates.forEach((candidate) => {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false });
  }
});

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

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  BACKEND_PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL."),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL."),
  CORS_ALLOWED_ORIGINS: z.string().trim().optional().default(""),
  SYNC_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(4000),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
  APP_VERSION: z.string().optional().default("0.1.0"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formatted = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`[backend-env] invalid environment: ${formatted}`);
}

export const backendEnv = {
  ...parsedEnv.data,
  PORT: parsedEnv.data.BACKEND_PORT ?? parsedEnv.data.PORT ?? 4013,
  corsAllowedOrigins: [
    parsedEnv.data.FRONTEND_URL,
    ...parsedEnv.data.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
};

backendEnv.corsAllowedOrigins.forEach((origin) => {
  optionalUrl.parse(origin);
});

export type BackendEnv = typeof backendEnv;

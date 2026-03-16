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
    BUILD_TARGET: z.enum(["static", "server"]).optional().default("server"),
    GENERATED_AT: z.string().optional().default(""),
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

export type FrontendRuntimeConfig = z.infer<typeof runtimeConfigSchema> & {
  apiBaseUrl: string;
  sseUrl: string;
  frontendUrl: string;
  healthUrl: string;
};

declare global {
  interface Window {
    __INDUSTRIAL_RUNTIME_CONFIG__?: Record<string, unknown>;
  }
}

let cachedConfig: FrontendRuntimeConfig | null = null;

export function getFrontendRuntimeConfig(): FrontendRuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const rawConfig =
    typeof window !== "undefined" && window.__INDUSTRIAL_RUNTIME_CONFIG__
      ? window.__INDUSTRIAL_RUNTIME_CONFIG__
      : process.env;
  const parsedConfig = runtimeConfigSchema.safeParse(rawConfig);

  if (!parsedConfig.success) {
    throw new Error(
      `[runtime-config] ${parsedConfig.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }

  const baseApiUrl = normalizeUrl(parsedConfig.data.NEXT_PUBLIC_API_URL);
  const sseUrl =
    normalizeUrl(parsedConfig.data.NEXT_PUBLIC_SSE_URL) ||
    `${baseApiUrl}/api/production/stream`;
  const healthUrl =
    normalizeUrl(parsedConfig.data.NEXT_PUBLIC_HEALTH_URL) ||
    `${baseApiUrl}/api/health`;

  cachedConfig = {
    ...parsedConfig.data,
    apiBaseUrl: baseApiUrl,
    sseUrl,
    healthUrl,
    frontendUrl: normalizeUrl(parsedConfig.data.NEXT_PUBLIC_FRONTEND_URL),
  };

  return cachedConfig;
}

function normalizeUrl(value: string) {
  return value.replace(/\/$/, "");
}

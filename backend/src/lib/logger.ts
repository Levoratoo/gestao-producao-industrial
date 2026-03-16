type LogLevel = "debug" | "info" | "warn" | "error";

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(level: LogLevel) {
  const currentLevelRank = levelRank[level];

  return {
    debug(message: string, context: Record<string, unknown> = {}) {
      writeLog("debug", message, context, currentLevelRank);
    },
    info(message: string, context: Record<string, unknown> = {}) {
      writeLog("info", message, context, currentLevelRank);
    },
    warn(message: string, context: Record<string, unknown> = {}) {
      writeLog("warn", message, context, currentLevelRank);
    },
    error(message: string, context: Record<string, unknown> = {}) {
      writeLog("error", message, context, currentLevelRank);
    },
  };
}

function writeLog(
  level: LogLevel,
  message: string,
  context: Record<string, unknown>,
  currentLevelRank: number,
) {
  if (levelRank[level] < currentLevelRank) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

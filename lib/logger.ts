import "server-only";
import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
      },
  redact: {
    paths: [
      "*.token",
      "*.apiKey",
      "*.password",
      "*.refresh_token",
      "*.access_token",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "***",
  },
});

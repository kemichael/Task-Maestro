import "server-only";
import { z } from "zod";
import { logger } from "./logger";

const slackTokenSchema = z.object({
  workspaceId: z.string().min(1),
  token: z.string().min(1),
});

// 空文字は未設定 (undefined) として扱う
const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const envSchema = z.object({
  BACKLOG_SPACE_DOMAIN: optionalNonEmpty,
  BACKLOG_API_KEY: optionalNonEmpty,
  GOOGLE_OAUTH_CLIENT_ID: optionalNonEmpty,
  GOOGLE_OAUTH_CLIENT_SECRET: optionalNonEmpty,
  GOOGLE_REFRESH_TOKEN: optionalNonEmpty,
  SLACK_TOKENS_JSON: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw || raw.trim() === "" || raw.trim() === "[]") return [];
      try {
        const parsed = JSON.parse(raw);
        return z.array(slackTokenSchema).parse(parsed);
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SLACK_TOKENS_JSON の形式が不正です: ${(error as Error).message}`,
        });
        return z.NEVER;
      }
    }),
  OPENAI_API_KEY: optionalNonEmpty,
  CLAUDE_CODE_PATH: optionalNonEmpty,
  LOG_LEVEL: optionalNonEmpty,
});

export type Env = z.infer<typeof envSchema>;

export interface EnvStatus {
  key: keyof Env;
  status: "ok" | "missing" | "invalid";
  required: boolean;
}

const MVP_REQUIRED: Array<keyof Env> = [
  "BACKLOG_SPACE_DOMAIN",
  "BACKLOG_API_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
];

const OPTIONAL_KEYS: Array<keyof Env> = [
  "SLACK_TOKENS_JSON",
  "OPENAI_API_KEY",
  "CLAUDE_CODE_PATH",
  "LOG_LEVEL",
];

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    logger.error({ issues: result.error.issues }, "環境変数のパースに失敗しました");
    throw new Error(
      `環境変数のパースに失敗: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  cached = result.data;
  return cached;
}

export function getEnvStatus(): EnvStatus[] {
  const env = getEnv();
  const statuses: EnvStatus[] = [];
  for (const key of MVP_REQUIRED) {
    const value = env[key];
    statuses.push({
      key,
      status: value && (typeof value !== "string" || value.length > 0) ? "ok" : "missing",
      required: true,
    });
  }
  for (const key of OPTIONAL_KEYS) {
    const value = env[key];
    statuses.push({
      key,
      status:
        value && (Array.isArray(value) ? value.length > 0 : value.toString().length > 0)
          ? "ok"
          : "missing",
      required: false,
    });
  }
  return statuses;
}

export function assertMvpEnv(env: Env): asserts env is Env & {
  BACKLOG_SPACE_DOMAIN: string;
  BACKLOG_API_KEY: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
} {
  const missing = MVP_REQUIRED.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`必須環境変数が未設定: ${missing.join(", ")}`);
  }
}

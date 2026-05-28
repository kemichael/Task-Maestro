import "server-only";
import { ExternalApiError, type ExternalApiErrorReason } from "../errors";
import { logger } from "../logger";

const DEFAULT_TIMEOUT_MS = 30_000;
const BACKOFF_DELAYS = [200, 600, 2000];

export interface FetchJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  /**
   * リクエストボディ:
   * - `string` または `URLSearchParams` の場合は、そのまま送出する (Content-Type は呼出側が指定)。
   * - それ以外のオブジェクトの場合は `JSON.stringify` され、`Content-Type: application/json` が付く。
   */
  body?: unknown;
  timeoutMs?: number;
  service: string;
}

export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions,
): Promise<T> {
  const { method = "GET", headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS, service } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const bodyIsString = typeof body === "string";
    const bodyIsFormData = body instanceof URLSearchParams;
    const serializedBody =
      body === undefined ? undefined : bodyIsString || bodyIsFormData ? (body as string | URLSearchParams) : JSON.stringify(body);
    const mergedHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(body !== undefined && !bodyIsString && !bodyIsFormData
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    };
    const response = await fetch(url, {
      method,
      headers: mergedHeaders,
      body: serializedBody,
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw mapHttpError(service, response.status, text);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new ExternalApiError(
        `${service} へのリクエストがタイムアウトしました`,
        "network",
        true,
        undefined,
        error,
      );
    }
    throw new ExternalApiError(
      `${service} へのリクエスト中にエラー: ${(error as Error).message}`,
      "network",
      true,
      undefined,
      error,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function mapHttpError(service: string, status: number, body: string): ExternalApiError {
  let reason: ExternalApiErrorReason = "unknown";
  let retryable = false;
  if (status === 401 || status === 403) {
    reason = "auth";
  } else if (status === 404) {
    reason = "notFound";
  } else if (status === 422 || status === 400) {
    reason = "validation";
  } else if (status === 429) {
    reason = "rateLimit";
    retryable = true;
  } else if (status >= 500) {
    reason = "network";
    retryable = true;
  }
  return new ExternalApiError(
    `${service} API がエラー応答: ${status} ${body.slice(0, 200)}`,
    reason,
    retryable,
    status,
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { service: string; maxAttempts?: number } = { service: "external" },
): Promise<T> {
  const max = options.maxAttempts ?? BACKOFF_DELAYS.length + 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const apiError = error instanceof ExternalApiError ? error : null;
      const retryable = apiError ? apiError.retryable : false;
      if (!retryable || attempt === max - 1) {
        throw error;
      }
      const delay = BACKOFF_DELAYS[Math.min(attempt, BACKOFF_DELAYS.length - 1)];
      logger.debug({ service: options.service, attempt, delay }, "リトライ待機");
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastError;
}

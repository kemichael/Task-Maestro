import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson, mapHttpError, withRetry } from "@/lib/clients/_common";
import { ExternalApiError } from "@/lib/errors";

describe("mapHttpError", () => {
  it("401 は auth", () => {
    const err = mapHttpError("test", 401, "Unauthorized");
    expect(err).toBeInstanceOf(ExternalApiError);
    expect(err.reason).toBe("auth");
    expect(err.retryable).toBe(false);
  });

  it("404 は notFound", () => {
    const err = mapHttpError("test", 404, "");
    expect(err.reason).toBe("notFound");
    expect(err.retryable).toBe(false);
  });

  it("429 は rateLimit + retryable", () => {
    const err = mapHttpError("test", 429, "Too Many Requests");
    expect(err.reason).toBe("rateLimit");
    expect(err.retryable).toBe(true);
  });

  it("5xx は network + retryable", () => {
    const err = mapHttpError("test", 500, "Server Error");
    expect(err.reason).toBe("network");
    expect(err.retryable).toBe(true);
  });

  it("422 は validation", () => {
    const err = mapHttpError("test", 422, "");
    expect(err.reason).toBe("validation");
    expect(err.retryable).toBe(false);
  });

  it("originalStatus を保持", () => {
    const err = mapHttpError("test", 418, "I'm a teapot");
    expect(err.originalStatus).toBe(418);
  });
});

describe("fetchJson", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("オブジェクト body は JSON.stringify + application/json", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await fetchJson("https://example.com/x", {
      method: "POST",
      service: "test",
      body: { a: 1 },
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("文字列 body はそのまま送出 (Content-Type 自動付与しない)", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await fetchJson("https://example.com/x", {
      method: "POST",
      service: "test",
      body: "a=1&b=2",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe("a=1&b=2");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("URLSearchParams body はそのまま送出 + Content-Type 自動付与しない", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const params = new URLSearchParams({ a: "1" });
    await fetchJson("https://example.com/x", {
      method: "POST",
      service: "test",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(params);
  });

  it("204 は undefined を返却", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await fetchJson("https://example.com/x", { service: "test" });
    expect(result).toBeUndefined();
  });

  it("非 ok ステータスは ExternalApiError", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));
    await expect(fetchJson("https://example.com/x", { service: "test" })).rejects.toBeInstanceOf(
      ExternalApiError,
    );
  });
});

describe("withRetry", () => {
  it("retryable=true のエラーはリトライする", async () => {
    let count = 0;
    const result = await withRetry(
      async () => {
        count++;
        if (count < 2) throw new ExternalApiError("temp", "rateLimit", true, 429);
        return "ok";
      },
      { service: "test", maxAttempts: 4 },
    );
    expect(result).toBe("ok");
    expect(count).toBe(2);
  });

  it("retryable=false のエラーは即時失敗", async () => {
    let count = 0;
    await expect(
      withRetry(
        async () => {
          count++;
          throw new ExternalApiError("auth", "auth", false, 401);
        },
        { service: "test", maxAttempts: 4 },
      ),
    ).rejects.toBeInstanceOf(ExternalApiError);
    expect(count).toBe(1);
  });

  it("最大試行回数を超えると失敗", async () => {
    let count = 0;
    await expect(
      withRetry(
        async () => {
          count++;
          throw new ExternalApiError("temp", "rateLimit", true, 429);
        },
        { service: "test", maxAttempts: 2 },
      ),
    ).rejects.toBeInstanceOf(ExternalApiError);
    expect(count).toBe(2);
  });
});

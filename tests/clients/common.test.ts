import { describe, expect, it } from "vitest";
import { mapHttpError } from "@/lib/clients/_common";
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

import { describe, expect, it } from "vitest";
import {
  AppError,
  EnvMissingError,
  ExternalApiError,
  MappingMissingError,
  ValidationError,
} from "@/lib/errors";

describe("error classes", () => {
  it("AppError は name を継承先のクラス名に設定", () => {
    const err = new EnvMissingError(["FOO"]);
    expect(err.name).toBe("EnvMissingError");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(EnvMissingError);
    expect(err.missingKeys).toEqual(["FOO"]);
  });

  it("MappingMissingError は projectId を保持", () => {
    const err = new MappingMissingError(42);
    expect(err.projectId).toBe(42);
    expect(err.message).toContain("42");
  });

  it("ExternalApiError は reason / retryable / originalStatus を保持", () => {
    const err = new ExternalApiError("msg", "rateLimit", true, 429);
    expect(err.reason).toBe("rateLimit");
    expect(err.retryable).toBe(true);
    expect(err.originalStatus).toBe(429);
  });

  it("ValidationError は issues を保持", () => {
    const err = new ValidationError("invalid", [{ field: "x" }]);
    expect(err.issues).toEqual([{ field: "x" }]);
  });
});

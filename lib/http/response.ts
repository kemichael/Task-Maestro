import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AppError,
  EnvMissingError,
  ExternalApiError,
  MappingMissingError,
  NotFoundError,
  ValidationError,
} from "../errors";
import { logger } from "../logger";

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "validation", issues: error.issues },
      { status: 400 },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: "validation", message: error.message, issues: error.issues },
      { status: 400 },
    );
  }
  if (error instanceof EnvMissingError) {
    return NextResponse.json(
      { error: "env_missing", message: error.message, missingKeys: error.missingKeys },
      { status: 412 },
    );
  }
  if (error instanceof MappingMissingError) {
    return NextResponse.json(
      { error: "mapping_missing", message: error.message, projectId: error.projectId },
      { status: 412 },
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: "not_found", message: error.message }, { status: 404 });
  }
  if (error instanceof ExternalApiError) {
    const status = error.originalStatus ?? (error.reason === "auth" ? 401 : 502);
    return NextResponse.json(
      { error: error.reason, message: error.message, originalStatus: error.originalStatus },
      { status },
    );
  }
  if (error instanceof AppError) {
    logger.error({ err: error }, "AppError");
    return NextResponse.json({ error: "app_error", message: error.message }, { status: 500 });
  }
  logger.error({ err: error }, "Unhandled error");
  return NextResponse.json(
    { error: "internal", message: (error as Error).message ?? "unknown" },
    { status: 500 },
  );
}

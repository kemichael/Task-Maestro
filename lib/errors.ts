export class AppError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class EnvMissingError extends AppError {
  constructor(public readonly missingKeys: string[]) {
    super(`必須の環境変数が未設定: ${missingKeys.join(", ")}`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly issues?: unknown) {
    super(message);
  }
}

export class NotFoundError extends AppError {}

export class DatabaseError extends AppError {}

export class MappingMissingError extends AppError {
  constructor(public readonly projectId: number) {
    super(`プロジェクト ${projectId} のステータスマッピングが未設定です`);
  }
}

export class AiProviderError extends AppError {}

export type ExternalApiErrorReason =
  | "auth"
  | "rateLimit"
  | "notFound"
  | "network"
  | "validation"
  | "unknown";

export class ExternalApiError extends AppError {
  constructor(
    message: string,
    public readonly reason: ExternalApiErrorReason,
    public readonly retryable: boolean,
    public readonly originalStatus?: number,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

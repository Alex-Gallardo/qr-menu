/**
 * Error de la app con un mensaje apto para mostrar al usuario (sin jerga).
 * Las Server Actions lo convierten en `{ ok: false, message }`.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly userMessage: string,
  ) {
    super(`${code}: ${userMessage}`);
    this.name = "AppError";
  }
}

export type AccessErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "branch_forbidden"
  | "role_forbidden"
  | "feature_unavailable"
  | "read_only"
  | "license_inactive";

export class AccessError extends AppError {
  constructor(
    readonly accessCode: AccessErrorCode,
    userMessage: string,
  ) {
    super(accessCode, userMessage);
    this.name = "AccessError";
  }
}

export class LimitExceededError extends AppError {
  constructor(
    readonly resource: string,
    readonly limit: number,
    userMessage: string,
  ) {
    super("limit_exceeded", userMessage);
    this.name = "LimitExceededError";
  }
}

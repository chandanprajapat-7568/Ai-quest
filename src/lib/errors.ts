/**
 * Error types shared by the API layer.
 *
 * Algorithms and validators throw these; `api-utils.ts` turns them into JSON
 * responses. Unknown errors never reach the browser (they become a generic 500).
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Thrown when the request body is invalid -> HTTP 400 INVALID_REQUEST. */
export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, "INVALID_REQUEST", message);
    this.name = "ValidationError";
  }
}

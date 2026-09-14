export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR";

/** Every successful backend response is wrapped in this envelope. */
export interface IApiSuccess<T> {
  success: true;
  data: T;
}

/** Every failed backend response uses this shape. */
export interface IApiErrorBody {
  success: false;
  message: string;
  code: ApiErrorCode | string;
  details?: unknown;
}

export interface IDeleted {
  deleted: true;
}

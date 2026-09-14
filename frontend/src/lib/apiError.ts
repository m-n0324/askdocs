import type { IApiErrorBody } from "@/interfaces";

/** Error thrown for every non-2xx backend response. `message` is safe to show to users. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Used when the body isn't our JSON envelope (e.g. an HTML error page from a proxy).
const STATUS_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Please log in again.",
  404: "We couldn't find that.",
  413: "That file is too large.",
  415: "That file type isn't supported.",
  429: "You're going a bit fast. Please wait a moment and try again.",
};
const SERVER_ERROR_MESSAGE = "The server ran into a problem. Please try again.";

const isErrorBody = (value: unknown): value is IApiErrorBody =>
  typeof value === "object" && value !== null && "message" in value && typeof value.message === "string";

/** Reads the `{ success: false, message, code }` envelope from a failed response. */
export async function readApiError(response: Response): Promise<ApiError> {
  const fallback = STATUS_MESSAGES[response.status] ?? SERVER_ERROR_MESSAGE;
  try {
    const body: unknown = await response.clone().json();
    if (isErrorBody(body)) {
      return new ApiError(body.message || fallback, response.status, String(body.code ?? ""), body.details);
    }
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return new ApiError(fallback, response.status, "UNKNOWN");
}

/** Client errors (4xx) won't succeed on retry, so React Query shouldn't retry them. */
export function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

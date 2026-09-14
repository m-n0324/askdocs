const DEFAULT_ERROR = "Something went wrong. Please try again.";

/** Turns anything thrown into a sentence we can show to the user. */
export function getErrorMessage(error: unknown, fallback: string = DEFAULT_ERROR): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "The request timed out. Please try again.";
  }
  // fetch() throws a TypeError when the server can't be reached at all.
  if (error instanceof TypeError) return "Can't reach the server. Check your connection.";
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

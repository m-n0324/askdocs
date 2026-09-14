export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const API_TIMEOUT_MS = 30_000;
export const QUERY_STALE_TIME_MS = 60_000;
export const SESSION_STORAGE_KEY = "askdocs-session";
/** Uploads of up to 10 MB need more time than a normal JSON request. */
export const UPLOAD_TIMEOUT_MS = 120_000;

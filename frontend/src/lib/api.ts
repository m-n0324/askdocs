import wretch from "wretch";
import QueryStringAddon from "wretch/addons/queryString";
import { API_TIMEOUT_MS, API_URL } from "@/constants";
import type { IApiSuccess } from "@/interfaces";
import { readApiError } from "@/lib/apiError";
import { getAuthToken, handleUnauthorized } from "@/lib/session";

interface IRequestOptions {
  timeoutMs?: number;
  /** Pass your own signal (e.g. from an AbortController) instead of the default timeout. */
  signal?: AbortSignal;
}

const base = wretch(API_URL)
  .addon(QueryStringAddon)
  .headers({ Accept: "application/json" })
  // Every non-2xx response is turned into an ApiError carrying the backend's message.
  .customError((_error, response) => readApiError(response));

/** Request chain for public endpoints (login, signup). Each call gets a fresh signal. */
export const api = ({ timeoutMs = API_TIMEOUT_MS, signal }: IRequestOptions = {}) => {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return base.options({ signal: signal ?? AbortSignal.timeout(timeoutMs) });
};

/** Request chain for endpoints that need the JWT. A 401 logs the user out. */
export const authApi = (options: IRequestOptions = {}) => {
  const token = getAuthToken();
  const request = api(options).catcher(401, (error) => {
    handleUnauthorized();
    throw error;
  });
  return token ? request.auth(`Bearer ${token}`) : request;
};

/** Backend wraps data in `{ success, data }`; services return just `data`. */
export const unwrap = <T>(body: IApiSuccess<T>): T => body.data;

"use client";

/**
 * Client for the app's own API. Cookies are HttpOnly, so the browser never
 * sees a token: when the access token expires, the server answers
 * `token_expired`, this client calls /api/auth/refresh once and retries.
 * If the session is over it emits "lia:session-ended" for the AuthProvider.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const SESSION_ENDED_EVENT = "lia:session-ended";

let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const run = async () => {
    const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
    if (response.ok) return true;
    // Another tab rotated it a moment ago: its new cookies are already ours.
    if (response.status === 409) return true;
    const data = await response.json().catch(() => ({})) as { code?: string };
    window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { reason: data.code ?? "session_ended" } }));
    return false;
  };
  // One refresh at a time across tabs, so rotation doesn't look like token reuse.
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  return locks ? locks.request("lia-refresh", run) : run();
}

/** Rotates the session. Deduplicated: parallel callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; retry?: boolean };

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: options.body === undefined ? undefined : { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
  if (response.ok) return data as T;

  if (response.status === 401 && data.code === "token_expired" && options.retry !== false) {
    if (await refreshSession()) return api<T>(path, { ...options, retry: false });
  }
  throw new ApiError(data.error ?? "Ocurrió un error. Inténtalo de nuevo.", response.status, data.code);
}

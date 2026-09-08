import { z } from "zod";

const apiUrlSchema = z
  .url()
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "API URL must use HTTP or HTTPS",
  );

export function getApiBaseUrl(): string {
  return apiUrlSchema
    .parse(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1")
    .replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

let refreshing: Promise<void> | null = null;
async function request(path: string, init: RequestInit): Promise<Response> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid API path");
  try {
    return await fetch(getApiBaseUrl() + path, { ...init, credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1", ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(15000) });
  } catch { throw new ApiError(0, "Unable to reach the API. Check your connection and try again."); }
}
async function refreshSession() {
  const refresh = async () => {
    const result = await request("/auth/refresh", { method: "POST" });
    if (!result.ok) {
      if (result.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("gst:session-ended"));
      throw new ApiError(result.status, result.status === 401 ? "Your session has ended. Sign in again." : "Unable to refresh your session. Try again later.");
    }
  };
  // Coordinate refresh across tabs as well as requests in this tab.
  if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request("gst-session-refresh", refresh);
  else await refresh();
}
export async function api<T = unknown>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  let response = await request(path, init);
  if (response.status === 401 && retry) {
    refreshing ??= refreshSession().finally(() => { refreshing = null; });
    await refreshing;
    response = await request(path, init);
  }
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "message" in body ? body.message : null;
    throw new ApiError(response.status, typeof message === "string" ? message : Array.isArray(message) ? message.join(". ") : "Unable to complete request");
  }
  return body as T;
}

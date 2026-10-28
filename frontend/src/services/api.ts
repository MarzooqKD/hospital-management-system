import axios, { type InternalAxiosRequestConfig } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL });

// Set by AuthContext once a user logs in. Kept out of React state so the
// interceptor (which runs outside any component) can always read the
// latest value without a circular import.
let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

const REFRESH_TOKEN_KEY = "hms_refresh_token";

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

// AuthContext registers this so a dead session (refresh token expired or
// revoked) drops the user back to the login screen instead of leaving a
// half-broken page.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

let refreshInFlight: Promise<string> | null = null;

/** Trades the stored refresh token for a fresh access token. The backend
 * rotates refresh tokens and blacklists the old one on every use, so the
 * new one must be stored, and concurrent callers must share one request —
 * a second call with the same token would be rejected and sign the user
 * out. Uses bare `axios`, not `api`, so it can't trigger the 401 handling
 * below. */
export function refreshSession(): Promise<string> {
  refreshInFlight ??= (async () => {
    const used = getRefreshToken();
    if (!used) throw new Error("No refresh token");
    try {
      const { data } = await axios.post<{ access: string; refresh?: string }>(
        `${baseURL}/auth/token/refresh/`,
        { refresh: used },
      );
      setAccessToken(data.access);
      if (data.refresh) setRefreshToken(data.refresh);
      return data.access;
    } catch (err) {
      // Another tab may have rotated the token meanwhile — don't wipe its newer one.
      if (getRefreshToken() === used) setRefreshToken(null);
      throw err;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Access tokens live 15 minutes. When one expires mid-session the API answers
// 401; renew it once and replay the request so a long-lived tab keeps working.
api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error)) throw error;
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthRequest = original?.url?.startsWith("/auth/") ?? false;

  if (error.response?.status !== 401 || !original || original._retried || isAuthRequest) {
    throw error;
  }
  original._retried = true;

  // A parallel request may already have renewed the token since this one was sent.
  if (accessToken && original.headers.Authorization !== `Bearer ${accessToken}`) {
    original.headers.Authorization = `Bearer ${accessToken}`;
    return api(original);
  }

  let renewed: string;
  try {
    renewed = await refreshSession();
  } catch {
    setAccessToken(null);
    onSessionExpired?.();
    throw error;
  }
  original.headers.Authorization = `Bearer ${renewed}`;
  return api(original);
});

export interface HealthStatus {
  status: "ok" | "degraded";
  database: "connected" | "unreachable";
}

export async function fetchHealth(): Promise<HealthStatus> {
  const { data } = await api.get<HealthStatus>("/health/");
  return data;
}

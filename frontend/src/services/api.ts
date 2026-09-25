import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL });

// Set by AuthContext once a user logs in. Kept out of React state so the
// interceptor (which runs outside any component) can always read the
// latest value without a circular import.
let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export interface HealthStatus {
  status: "ok" | "degraded";
  database: "connected" | "unreachable";
}

export async function fetchHealth(): Promise<HealthStatus> {
  const { data } = await api.get<HealthStatus>("/health/");
  return data;
}

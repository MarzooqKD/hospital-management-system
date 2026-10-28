import { api } from "./api";
import type { CurrentUser, TokenPair } from "../types/auth";

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/auth/token/", { email, password });
  return data;
}

export async function logout(refresh: string): Promise<void> {
  await api.post("/auth/logout/", { refresh });
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await api.get<CurrentUser>("/users/me/");
  return data;
}

export async function fetchAllUsers(): Promise<CurrentUser[]> {
  const { data } = await api.get<{ results: CurrentUser[] }>("/users/");
  return data.results;
}

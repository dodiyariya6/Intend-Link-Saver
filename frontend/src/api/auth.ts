import { apiFetch } from "./client";
import type { LoginPayload, RegisterPayload, Token, User } from "./types";

export function registerUser(payload: RegisterPayload): Promise<User> {
  return apiFetch<User>("/auth/register", { method: "POST", body: payload, skipAuth: true });
}

export function loginUser(payload: LoginPayload): Promise<Token> {
  return apiFetch<Token>("/auth/login", { method: "POST", body: payload, skipAuth: true });
}

export function logoutUser(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function getCurrentUser(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

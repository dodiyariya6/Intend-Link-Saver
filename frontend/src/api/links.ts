import { apiFetch } from "./client";
import type { CreateLinkPayload, EnrichResponse, Link, LinkListResponse } from "./types";

export function listLinks(params: { page?: number; page_size?: number } = {}): Promise<LinkListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  const qs = query.toString();
  return apiFetch<LinkListResponse>(`/links${qs ? `?${qs}` : ""}`);
}

export function createLink(payload: CreateLinkPayload): Promise<Link> {
  return apiFetch<Link>("/links", { method: "POST", body: payload });
}

export function deleteLink(id: string): Promise<void> {
  return apiFetch<void>(`/links/${id}`, { method: "DELETE" });
}

export function enrichLink(id: string): Promise<EnrichResponse> {
  return apiFetch<EnrichResponse>(`/links/${id}/enrich`, { method: "POST" });
}

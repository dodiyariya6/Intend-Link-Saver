import { apiFetch } from "./client";
import type { AskResponse, SearchResponse } from "./types";

export function searchLinks(query: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  return apiFetch<SearchResponse>(`/search?${params.toString()}`);
}

export function askMemoryAssistant(question: string): Promise<AskResponse> {
  return apiFetch<AskResponse>("/search/ask", { method: "POST", body: { question } });
}

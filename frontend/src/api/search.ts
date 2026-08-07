import { apiFetch } from "./client";
import type { SearchResponse } from "./types";

export function searchLinks(query: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  return apiFetch<SearchResponse>(`/search?${params.toString()}`);
}

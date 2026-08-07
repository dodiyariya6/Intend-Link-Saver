/** API request/response types — hand-mirrored from the backend's Pydantic schemas. */

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface Link {
  id: string;
  url: string;
  title: string | null;
  ai_summary: string | null;
  user_note: string | null;
  ai_reason: string | null;
  intent_category: string | null;
  status: string;
  tags: string[];
  created_at: string;
}

export interface LinkListResponse {
  items: Link[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CreateLinkPayload {
  url: string;
  note?: string;
}

export interface EnrichResponse {
  success: boolean;
  detail: string;
  link: Link;
  embedding_generated: boolean;
}

export interface SearchResultItem extends Link {
  similarity: number;
}

export interface SearchResponse {
  query: string;
  items: SearchResultItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

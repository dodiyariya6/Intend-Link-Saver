import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, AUTH_TOKEN_KEY, apiFetch, onUnauthorized } from "../client";

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }) {
  const { jsonBody, ...rest } = response;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => jsonBody,
      ...rest,
    } as Response),
  );
}

describe("apiFetch", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the Authorization header when a token is stored", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "test-token");
    mockFetchOnce({ jsonBody: { ok: true } });

    await apiFetch("/some/path");

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("does not attach a token when skipAuth is set, even if one is stored", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "test-token");
    mockFetchOnce({ jsonBody: { ok: true } });

    await apiFetch("/auth/login", { skipAuth: true });

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("serializes the body as JSON", async () => {
    mockFetchOnce({ jsonBody: {} });
    await apiFetch("/x", { method: "POST", body: { email: "a@example.com" } });
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[1]?.body).toBe(JSON.stringify({ email: "a@example.com" }));
  });

  it("throws a typed ApiError with the backend's detail message on failure", async () => {
    mockFetchOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      jsonBody: { detail: "Incorrect email or password" },
    });

    await expect(apiFetch("/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 401,
      detail: "Incorrect email or password",
    });
  });

  it("wraps a thrown error in ApiError", async () => {
    mockFetchOnce({ ok: false, status: 500, statusText: "Internal Server Error", jsonBody: undefined });
    try {
      await apiFetch("/x");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }
  });

  it("notifies onUnauthorized listeners on a 401 response", async () => {
    mockFetchOnce({ ok: false, status: 401, statusText: "Unauthorized", jsonBody: { detail: "nope" } });

    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    await apiFetch("/protected").catch(() => {});
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it("returns undefined for a 204 No Content response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204, statusText: "No Content" } as Response),
    );
    const result = await apiFetch("/auth/logout", { method: "POST" });
    expect(result).toBeUndefined();
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../../../api/auth";
import { ApiError, apiFetch, AUTH_TOKEN_KEY } from "../../../api/client";
import { AuthProvider, useAuth } from "../AuthContext";

vi.mock("../../../api/auth");

function Harness() {
  const { user, status, sessionExpired, login, register, logout } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user">{user?.email ?? "none"}</div>
      <div data-testid="session-expired">{String(sessionExpired)}</div>
      <button onClick={() => login({ email: "a@example.com", password: "supersecret123" })}>
        login
      </button>
      <button onClick={() => register({ email: "a@example.com", password: "supersecret123" })}>
        register
      </button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

const mockUser = { id: "1", email: "a@example.com", created_at: "2026-01-01T00:00:00Z" };

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("boots as unauthenticated when there is no stored token", async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
  });

  it("boots as authenticated when a stored token is valid", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "valid-token");
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("a@example.com");
  });

  it("clears an invalid stored token and boots as unauthenticated", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "bad-token");
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401, "invalid token"));

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it("login stores the token and populates the user", async () => {
    vi.mocked(authApi.loginUser).mockResolvedValue({ access_token: "new-token", token_type: "bearer" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe("new-token");
  });

  it("register calls register then auto-logs in", async () => {
    vi.mocked(authApi.registerUser).mockResolvedValue(mockUser);
    vi.mocked(authApi.loginUser).mockResolvedValue({ access_token: "new-token", token_type: "bearer" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    await act(async () => screen.getByText("register").click());

    expect(authApi.registerUser).toHaveBeenCalledOnce();
    expect(authApi.loginUser).toHaveBeenCalledOnce();
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });

  it("logout clears the token even if the API call fails", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "valid-token");
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(authApi.logoutUser).mockRejectedValue(new Error("network error"));

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await act(async () => screen.getByText("logout").click());

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it("sets sessionExpired and clears the session when a real 401 fires elsewhere in the app", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "valid-token");
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    // Trigger a real 401 through the actual apiFetch (not mocked) — this is
    // the same mechanism any future feature's API call would use, so it
    // exercises AuthContext's real onUnauthorized subscription rather than
    // calling internals directly.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ detail: "Could not validate credentials" }),
      } as Response),
    );

    await act(async () => {
      await apiFetch("/links").catch(() => {});
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("session-expired")).toHaveTextContent("true");
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();

    vi.unstubAllGlobals();
  });
});

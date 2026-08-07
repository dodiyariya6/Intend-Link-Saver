/**
 * End-to-end-in-jsdom integration test: exercises the real App component
 * (real router, real AuthProvider, real guards) with only the API layer
 * mocked — covers the full register -> shell -> logout -> redirect loop
 * described in the module's verification checklist, in addition to the
 * live-backend Playwright run.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import * as authApi from "../../api/auth";
import { AUTH_TOKEN_KEY } from "../../api/client";
import * as linksApi from "../../api/links";

vi.mock("../../api/auth");
vi.mock("../../api/links");

const mockUser = { id: "1", email: "person@example.com", created_at: "2026-01-01T00:00:00Z" };
const emptyLinks = { items: [], total: 0, page: 1, page_size: 20, pages: 0 };

describe("App (routing + auth integration)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
    vi.mocked(linksApi.listLinks).mockResolvedValue(emptyLinks);
  });
  afterEach(() => localStorage.clear());

  it("redirects an unauthenticated visitor from / to /login", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument());
  });

  it("registering lands on the authenticated shell (Home page) with the user menu", async () => {
    vi.mocked(authApi.registerUser).mockResolvedValue(mockUser);
    vi.mocked(authApi.loginUser).mockResolvedValue({ access_token: "tok", token_type: "bearer" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    render(<App />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument());

    await userEvent.click(screen.getByRole("link", { name: "Create one" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByLabelText("Email"), "person@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "supersecret123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    // authenticated shell: nav bar + Home page content + user menu
    await waitFor(() => expect(screen.getByRole("banner")).toBeInTheDocument());
    expect(screen.getByText("person@example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Save a link" })).toBeInTheDocument();
  });

  it("logging out returns to /login and blocks re-entry to the protected route", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "existing-token");
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(authApi.logoutUser).mockResolvedValue(undefined);

    render(<App />);
    await waitFor(() => expect(screen.getByRole("banner")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument());
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it("an already-authenticated user visiting /login is redirected to the app", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "existing-token");
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);
    window.history.pushState({}, "", "/login");

    render(<App />);
    await waitFor(() => expect(screen.getByRole("banner")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("navigating to /search shows the Search page within the same shell", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "existing-token");
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    render(<App />);
    await waitFor(() => expect(screen.getByRole("banner")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("heading", { name: "Search" })).toBeInTheDocument();
  });
});

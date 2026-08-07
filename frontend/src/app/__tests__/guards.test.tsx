import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { User } from "../../api/types";
import { AuthContext } from "../../features/auth/AuthContext";
import { PublicOnlyRoute, RequireAuth } from "../guards";

function withAuthValue(
  status: "idle" | "authenticated" | "unauthenticated",
  user: User | null = null,
) {
  return {
    user,
    status,
    sessionExpired: false,
    clearSessionExpired: () => {},
    login: async () => {},
    register: async () => {},
    logout: async () => {},
  };
}

function renderGuarded(guardStatus: "idle" | "authenticated" | "unauthenticated", route: string) {
  return render(
    <AuthContext.Provider value={withAuthValue(guardStatus)}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <div>Protected Home</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("RequireAuth", () => {
  it("shows a loader while status is idle", () => {
    renderGuarded("idle", "/");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Protected Home")).not.toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    renderGuarded("unauthenticated", "/");
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Home")).not.toBeInTheDocument();
  });

  it("renders the protected content when authenticated", () => {
    renderGuarded("authenticated", "/");
    expect(screen.getByText("Protected Home")).toBeInTheDocument();
  });
});

describe("PublicOnlyRoute", () => {
  function renderPublicOnly(guardStatus: "idle" | "authenticated" | "unauthenticated") {
    return render(
      <AuthContext.Provider value={withAuthValue(guardStatus)}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/" element={<div>Home</div>} />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <div>Login Form</div>
                </PublicOnlyRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
  }

  it("shows the login form when unauthenticated", () => {
    renderPublicOnly("unauthenticated");
    expect(screen.getByText("Login Form")).toBeInTheDocument();
  });

  it("redirects an already-authenticated user away from /login", () => {
    renderPublicOnly("authenticated");
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.queryByText("Login Form")).not.toBeInTheDocument();
  });
});

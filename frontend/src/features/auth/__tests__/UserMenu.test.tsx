import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { User } from "../../../api/types";
import { AuthContext, type AuthStatus } from "../AuthContext";
import { UserMenu } from "../components/UserMenu";

const mockUser: User = { id: "1", email: "person@example.com", created_at: "2026-01-01T00:00:00Z" };

function withQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderUserMenu(logout = vi.fn()) {
  return render(
    withQueryClient(
      <AuthContext.Provider
        value={{
          user: mockUser,
          status: "authenticated",
          sessionExpired: false,
          clearSessionExpired: () => {},
          login: async () => {},
          register: async () => {},
          logout,
        }}
      >
        <UserMenu />
      </AuthContext.Provider>,
    ),
  );
}

function renderUnauthenticated() {
  return render(
    withQueryClient(
      <AuthContext.Provider
        value={{
          user: null,
          status: "unauthenticated" as AuthStatus,
          sessionExpired: false,
          clearSessionExpired: () => {},
          login: async () => {},
          register: async () => {},
          logout: async () => {},
        }}
      >
        <UserMenu />
      </AuthContext.Provider>,
    ),
  );
}

describe("UserMenu", () => {
  it("renders the user's email and an avatar initial", () => {
    renderUserMenu();
    expect(screen.getByText("person@example.com")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("calls logout when clicked", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderUserMenu(logout);
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it("renders nothing when there is no user", () => {
    const { container } = renderUnauthenticated();
    expect(container).toBeEmptyDOMElement();
  });
});

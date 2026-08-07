import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../../../api/auth";
import { ApiError, AUTH_TOKEN_KEY } from "../../../api/client";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { LoginForm } from "../components/LoginForm";

vi.mock("../../../api/auth");

const mockUser = { id: "1", email: "user@example.com", created_at: "2026-01-01T00:00:00Z" };

function renderLoginRoute() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/" element={<div>Home (protected)</div>} />
    </Routes>,
    { route: "/login" },
  );
}

describe("LoginForm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => localStorage.clear());

  it("shows validation errors for an empty submit", async () => {
    renderLoginRoute();
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(authApi.loginUser).not.toHaveBeenCalled();
  });

  it("shows an inline error on invalid credentials (401)", async () => {
    vi.mocked(authApi.loginUser).mockRejectedValue(new ApiError(401, "Incorrect email or password"));
    renderLoginRoute();

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpassword");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });

  it("logs in and navigates to the app on success", async () => {
    vi.mocked(authApi.loginUser).mockResolvedValue({ access_token: "tok", token_type: "bearer" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);
    renderLoginRoute();

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(screen.getByText("Home (protected)")).toBeInTheDocument());
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe("tok");
  });
});

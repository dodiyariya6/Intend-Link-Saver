import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../../../api/auth";
import { ApiError } from "../../../api/client";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { RegisterForm } from "../components/RegisterForm";

vi.mock("../../../api/auth");

const mockUser = { id: "1", email: "new@example.com", created_at: "2026-01-01T00:00:00Z" };

function renderRegisterRoute() {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterForm />} />
      <Route path="/" element={<div>Home (protected)</div>} />
    </Routes>,
    { route: "/register" },
  );
}

describe("RegisterForm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => localStorage.clear());

  it("shows validation errors for an empty submit", async () => {
    renderRegisterRoute();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(authApi.registerUser).not.toHaveBeenCalled();
  });

  it("shows a mismatch error when passwords don't match", async () => {
    renderRegisterRoute();
    await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(authApi.registerUser).not.toHaveBeenCalled();
  });

  it("shows an inline error with a login link when the email is already registered (409)", async () => {
    vi.mocked(authApi.registerUser).mockRejectedValue(
      new ApiError(409, "An account with this email already exists"),
    );
    renderRegisterRoute();

    await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "supersecret123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("An account with this email already exists.");
    expect(screen.getByRole("link", { name: "Log in instead" })).toBeInTheDocument();
  });

  it("registers, auto-logs in, and navigates to the app on success", async () => {
    vi.mocked(authApi.registerUser).mockResolvedValue(mockUser);
    vi.mocked(authApi.loginUser).mockResolvedValue({ access_token: "tok", token_type: "bearer" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);
    renderRegisterRoute();

    await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "supersecret123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(screen.getByText("Home (protected)")).toBeInTheDocument());
  });
});

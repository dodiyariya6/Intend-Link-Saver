import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppShell } from "../AppShell";
import { AuthLayout } from "../AuthLayout";
import { Container } from "../Container";

describe("Container", () => {
  it("renders children within a centered, max-width-constrained element", () => {
    render(<Container>content</Container>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("supports polymorphic rendering via the as prop", () => {
    render(<Container as="main">content</Container>);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

function renderShellAtRoutes() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <AppShell activeNav="dashboard">
              <p>Dashboard content</p>
            </AppShell>
          }
        />
        <Route
          path="/search"
          element={
            <AppShell activeNav="search">
              <p>Search content</p>
            </AppShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("renders the nav bar and main content region", () => {
    renderShellAtRoutes();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("marks the active nav item correctly", () => {
    renderShellAtRoutes();
    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Search" })).not.toHaveAttribute("aria-current");
  });

  it("navigates to /search when the Search nav item is clicked", async () => {
    renderShellAtRoutes();
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Search content")).toBeInTheDocument();
  });
});

describe("AuthLayout", () => {
  it("renders a page title and children", () => {
    render(
      <AuthLayout title="Log in">
        <p>form goes here</p>
      </AuthLayout>,
    );
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText("form goes here")).toBeInTheDocument();
  });
});

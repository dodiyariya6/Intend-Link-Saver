import { render, screen } from "@testing-library/react";
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

describe("AppShell", () => {
  it("renders the nav bar and main content region", () => {
    render(
      <AppShell activeNav="dashboard">
        <p>Dashboard content</p>
      </AppShell>,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("marks the active nav item correctly", () => {
    render(
      <AppShell activeNav="search">
        <p>Search content</p>
      </AppShell>,
    );
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
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

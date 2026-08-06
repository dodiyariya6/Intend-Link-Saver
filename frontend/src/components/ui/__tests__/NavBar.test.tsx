import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NavBar, NavLinkItem } from "../NavBar";

describe("NavBar", () => {
  it("renders as a landmark header with brand and nav items", () => {
    render(
      <NavBar brand="Intend Link Saver">
        <NavLinkItem active>Dashboard</NavLinkItem>
        <NavLinkItem>Search</NavLinkItem>
      </NavBar>,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Intend Link Saver")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("marks the active nav item with aria-current", () => {
    render(
      <NavBar brand="App">
        <NavLinkItem active>Dashboard</NavLinkItem>
        <NavLinkItem>Search</NavLinkItem>
      </NavBar>,
    );
    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Search" })).not.toHaveAttribute("aria-current");
  });

  it("fires onClick for nav items", async () => {
    const onClick = vi.fn();
    render(
      <NavBar brand="App">
        <NavLinkItem onClick={onClick}>Search</NavLinkItem>
      </NavBar>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders right-aligned actions", () => {
    render(<NavBar brand="App" actions={<button>Log out</button>} />);
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});

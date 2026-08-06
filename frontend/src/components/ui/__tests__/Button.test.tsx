import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button, IconButton } from "../Button";

describe("Button", () => {
  it("renders as a button with its label", () => {
    render(<Button>Save link</Button>);
    expect(screen.getByRole("button", { name: "Save link" })).toBeInTheDocument();
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables and marks aria-busy while loading, and blocks clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("respects the disabled prop", () => {
    render(<Button disabled>Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

describe("IconButton", () => {
  it("requires and renders an accessible name via aria-label", () => {
    render(<IconButton aria-label="Remove tag" />);
    expect(screen.getByRole("button", { name: "Remove tag" })).toBeInTheDocument();
  });
});

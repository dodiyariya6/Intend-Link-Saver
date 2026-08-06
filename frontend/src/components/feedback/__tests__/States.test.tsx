import { Inbox } from "lucide-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { CardSkeleton, Skeleton } from "../Skeleton";

describe("EmptyState", () => {
  it("renders title, description, and an optional action", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing saved yet"
        description="Paste a link above to get started"
        action={<button>Save a link</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Nothing saved yet" })).toBeInTheDocument();
    expect(screen.getByText("Paste a link above to get started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save a link" })).toBeInTheDocument();
  });

  it("hides the icon from the accessibility tree", () => {
    const { container } = render(<EmptyState icon={Inbox} title="Nothing here" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("ErrorState", () => {
  it("renders as an alert with a plain-language title", () => {
    render(<ErrorState title="Couldn't load your links" description="Check your connection and retry." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your links");
    expect(screen.getByText("Check your connection and retry.")).toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("is hidden from the accessibility tree (decorative)", () => {
    render(<Skeleton data-testid="skeleton-block" />);
    expect(screen.getByTestId("skeleton-block")).toHaveAttribute("aria-hidden", "true");
  });

  it("CardSkeleton renders without crashing and stays decorative", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

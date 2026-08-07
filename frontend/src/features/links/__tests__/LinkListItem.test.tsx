import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Link } from "../../../api/types";
import { LinkListItem } from "../components/LinkListItem";

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: "1",
    url: "https://example.com/pricing-guide",
    title: "Competitor Pricing Breakdown",
    ai_summary: "A guide to benchmarking pricing across a market.",
    user_note: null,
    ai_reason: null,
    intent_category: null,
    status: "ready",
    tags: [],
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("LinkListItem", () => {
  it("renders title, domain, and summary", () => {
    render(<LinkListItem link={makeLink()} />);
    expect(screen.getByRole("heading", { name: "Competitor Pricing Breakdown" })).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText(/benchmarking pricing/)).toBeInTheDocument();
  });

  it("falls back to the URL as the title when none is set", () => {
    render(<LinkListItem link={makeLink({ title: null })} />);
    expect(
      screen.getByRole("heading", { name: "https://example.com/pricing-guide" }),
    ).toBeInTheDocument();
  });

  it("prefers the user's own note over the AI-inferred reason", () => {
    render(
      <LinkListItem
        link={makeLink({ user_note: "For the Q3 deck", ai_reason: "Should not show" })}
      />,
    );
    expect(screen.getByText(/For the Q3 deck/)).toBeInTheDocument();
    expect(screen.queryByText(/Should not show/)).not.toBeInTheDocument();
  });

  it("shows the AI-inferred reason when there's no user note", () => {
    render(<LinkListItem link={makeLink({ user_note: null, ai_reason: "Looks useful later" })} />);
    expect(screen.getByText(/Looks useful later/)).toBeInTheDocument();
  });

  it("shows a status badge only when status is not 'ready'", () => {
    const { rerender } = render(<LinkListItem link={makeLink({ status: "ready" })} />);
    expect(screen.queryByText("ready")).not.toBeInTheDocument();

    rerender(<LinkListItem link={makeLink({ status: "enriched" })} />);
    expect(screen.getByText("enriched")).toBeInTheDocument();

    rerender(<LinkListItem link={makeLink({ status: "failed" })} />);
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("renders tags and intent category", () => {
    render(<LinkListItem link={makeLink({ intent_category: "research", tags: ["pricing", "saas"] })} />);
    expect(screen.getByText("research")).toBeInTheDocument();
    expect(screen.getByText("pricing")).toBeInTheDocument();
    expect(screen.getByText("saas")).toBeInTheDocument();
  });

  it("calls onDelete with the link id when the delete button is clicked", async () => {
    const onDelete = vi.fn();
    render(<LinkListItem link={makeLink()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("does not render a delete button when onDelete is not provided", () => {
    render(<LinkListItem link={makeLink()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

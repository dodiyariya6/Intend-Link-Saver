import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../api/client";
import * as searchApi from "../../../api/search";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { MemoryAssistantPage } from "../pages/MemoryAssistantPage";

vi.mock("../../../api/search");

const citedLink = {
  id: "1",
  url: "https://example.com/pricing",
  title: "Pricing Guide",
  ai_summary: "A guide to pricing strategy.",
  user_note: null,
  ai_reason: null,
  intent_category: "research",
  status: "enriched",
  tags: ["pricing"],
  created_at: "2026-01-01T00:00:00Z",
};

describe("MemoryAssistantPage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => localStorage.clear());

  it("shows a prompt before any question has been asked", () => {
    renderWithProviders(<MemoryAssistantPage />);
    expect(screen.getByRole("heading", { name: "Ask about your saved links" })).toBeInTheDocument();
    expect(searchApi.askMemoryAssistant).not.toHaveBeenCalled();
  });

  it("does nothing on submit when the question is empty", async () => {
    renderWithProviders(<MemoryAssistantPage />);
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(searchApi.askMemoryAssistant).not.toHaveBeenCalled();
  });

  it("asks, then displays the answer and cited links", async () => {
    vi.mocked(searchApi.askMemoryAssistant).mockResolvedValue({
      answer: "You saved 'Pricing Guide' for research.",
      cited_links: [citedLink],
    });

    renderWithProviders(<MemoryAssistantPage />);
    await userEvent.type(
      screen.getByLabelText("Ask about your saved links"),
      "what did I save about pricing?",
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("You saved 'Pricing Guide' for research.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pricing Guide" })).toBeInTheDocument();
    expect(searchApi.askMemoryAssistant).toHaveBeenCalledWith("what did I save about pricing?");
  });

  it("displays the answer with no cited links when nothing matched", async () => {
    vi.mocked(searchApi.askMemoryAssistant).mockResolvedValue({
      answer: "I couldn't find anything in your saved links about that.",
      cited_links: [],
    });

    renderWithProviders(<MemoryAssistantPage />);
    await userEvent.type(screen.getByLabelText("Ask about your saved links"), "anything?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText(/couldn't find anything/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pricing Guide" })).not.toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    vi.mocked(searchApi.askMemoryAssistant).mockRejectedValue(
      new ApiError(503, "Memory Assistant is temporarily unavailable: provider down"),
    );

    renderWithProviders(<MemoryAssistantPage />);
    await userEvent.type(screen.getByLabelText("Ask about your saved links"), "pricing?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("Memory Assistant is temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByText(/provider down/)).toBeInTheDocument();
  });

  it("shows a loading state while the request is in flight", async () => {
    let resolvePromise!: (value: { answer: string; cited_links: never[] }) => void;
    vi.mocked(searchApi.askMemoryAssistant).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    renderWithProviders(<MemoryAssistantPage />);
    await userEvent.type(screen.getByLabelText("Ask about your saved links"), "pricing?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();

    resolvePromise({ answer: "done", cited_links: [] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).not.toBeDisabled());
  });
});

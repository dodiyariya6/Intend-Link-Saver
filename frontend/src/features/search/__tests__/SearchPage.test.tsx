import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as searchApi from "../../../api/search";
import { ApiError } from "../../../api/client";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SearchPage } from "../pages/SearchPage";

vi.mock("../../../api/search");

const sampleResult = {
  id: "1",
  url: "https://example.com/a",
  title: "Pricing Guide",
  ai_summary: "A guide to pricing strategy.",
  user_note: null,
  ai_reason: null,
  intent_category: "research",
  status: "enriched",
  tags: ["pricing"],
  created_at: "2026-01-01T00:00:00Z",
  similarity: 0.92,
};

describe("SearchPage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => localStorage.clear());

  it("shows a prompt before any search has been submitted", () => {
    renderWithProviders(<SearchPage />);
    expect(screen.getByRole("heading", { name: "Find what you saved" })).toBeInTheDocument();
    expect(searchApi.searchLinks).not.toHaveBeenCalled();
  });

  it("does not search until the form is submitted", async () => {
    renderWithProviders(<SearchPage />);
    await userEvent.type(screen.getByLabelText("Search your saved links"), "pricing");
    expect(searchApi.searchLinks).not.toHaveBeenCalled();
  });

  it("shows matching results after submitting a query", async () => {
    vi.mocked(searchApi.searchLinks).mockResolvedValue({
      query: "pricing",
      items: [sampleResult],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    });

    renderWithProviders(<SearchPage />);
    await userEvent.type(screen.getByLabelText("Search your saved links"), "pricing");
    await userEvent.click(screen.getByRole("button", { name: "Search links" }));

    expect(await screen.findByRole("heading", { name: "Pricing Guide" })).toBeInTheDocument();
    expect(searchApi.searchLinks).toHaveBeenCalledWith("pricing");
  });

  it("shows an empty state when nothing matches", async () => {
    vi.mocked(searchApi.searchLinks).mockResolvedValue({
      query: "nonsense",
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      pages: 0,
    });

    renderWithProviders(<SearchPage />);
    await userEvent.type(screen.getByLabelText("Search your saved links"), "nonsense");
    await userEvent.click(screen.getByRole("button", { name: "Search links" }));

    expect(await screen.findByText("No links match that search yet")).toBeInTheDocument();
  });

  it("shows an error state when the search fails", async () => {
    vi.mocked(searchApi.searchLinks).mockRejectedValue(
      new ApiError(503, "Search is temporarily unavailable: provider down"),
    );

    renderWithProviders(<SearchPage />);
    await userEvent.type(screen.getByLabelText("Search your saved links"), "pricing");
    await userEvent.click(screen.getByRole("button", { name: "Search links" }));

    expect(await screen.findByText("Search is temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByText(/provider down/)).toBeInTheDocument();
  });
});

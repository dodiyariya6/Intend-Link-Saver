import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as linksApi from "../../../api/links";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { HomePage } from "../pages/HomePage";

vi.mock("../../../api/links");

const emptyList = { items: [], total: 0, page: 1, page_size: 20, pages: 0 };

const sampleLink = {
  id: "1",
  url: "https://example.com/a",
  title: "Example Article",
  ai_summary: null,
  user_note: "For later",
  ai_reason: null,
  intent_category: null,
  status: "ready",
  tags: [],
  created_at: "2026-01-01T00:00:00Z",
};

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => localStorage.clear());

  it("shows the empty state when there are no saved links", async () => {
    vi.mocked(linksApi.listLinks).mockResolvedValue(emptyList);
    renderWithProviders(<HomePage />);
    expect(await screen.findByText("Nothing saved yet")).toBeInTheDocument();
  });

  it("renders the recent links list", async () => {
    vi.mocked(linksApi.listLinks).mockResolvedValue({ ...emptyList, items: [sampleLink], total: 1 });
    renderWithProviders(<HomePage />);
    expect(await screen.findByRole("heading", { name: "Example Article" })).toBeInTheDocument();
  });

  it("shows an error state and retries on demand", async () => {
    vi.mocked(linksApi.listLinks).mockRejectedValueOnce(new Error("network error"));
    renderWithProviders(<HomePage />);
    expect(await screen.findByText("Couldn't load your links")).toBeInTheDocument();

    vi.mocked(linksApi.listLinks).mockResolvedValueOnce(emptyList);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Nothing saved yet")).toBeInTheDocument();
  });

  it("submits the save-link form, chains enrichment, and refreshes the list", async () => {
    vi.mocked(linksApi.listLinks).mockResolvedValue(emptyList);
    vi.mocked(linksApi.createLink).mockResolvedValue(sampleLink);
    vi.mocked(linksApi.enrichLink).mockResolvedValue({
      success: true,
      detail: "ok",
      link: sampleLink,
      embedding_generated: true,
    });

    renderWithProviders(<HomePage />);
    await screen.findByText("Nothing saved yet");

    await userEvent.type(screen.getByLabelText("URL"), "https://example.com/a");
    await userEvent.click(screen.getByRole("button", { name: "Save link" }));

    await waitFor(() => expect(linksApi.createLink).toHaveBeenCalledWith({ url: "https://example.com/a" }));
    await waitFor(() => expect(linksApi.enrichLink).toHaveBeenCalledWith("1"));
    // list is invalidated/refetched after a successful save
    await waitFor(() => expect(linksApi.listLinks).toHaveBeenCalledTimes(2));
  });

  it("shows a validation error when the URL is empty", async () => {
    vi.mocked(linksApi.listLinks).mockResolvedValue(emptyList);
    renderWithProviders(<HomePage />);
    await screen.findByText("Nothing saved yet");

    await userEvent.click(screen.getByRole("button", { name: "Save link" }));
    expect(screen.getByText("URL is required")).toBeInTheDocument();
    expect(linksApi.createLink).not.toHaveBeenCalled();
  });

  it("deletes a link when the delete button is clicked", async () => {
    vi.mocked(linksApi.listLinks).mockResolvedValue({ ...emptyList, items: [sampleLink], total: 1 });
    vi.mocked(linksApi.deleteLink).mockResolvedValue(undefined);

    renderWithProviders(<HomePage />);
    await screen.findByRole("heading", { name: "Example Article" });

    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    await waitFor(() => expect(linksApi.deleteLink).toHaveBeenCalledWith("1"));
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "../Toast";

function TestHarness() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast({ title: "Saved and summarized", tone: "success" })}>
        Show success
      </button>
      <button onClick={() => showToast({ title: "Couldn't save link", tone: "danger" })}>
        Show error
      </button>
    </div>
  );
}

describe("Toast", () => {
  it("useToast throws outside of a ToastProvider", () => {
    // suppress the expected React error-boundary console noise for this assertion
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken() {
      useToast();
      return null;
    }
    expect(() => render(<Broken />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });

  it("shows a toast with an accessible live region and lets it be dismissed", async () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Show success" }));
    const toast = await screen.findByText("Saved and summarized");
    expect(toast).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await waitFor(() => expect(screen.queryByText("Saved and summarized")).not.toBeInTheDocument());
  });

  it("renders danger toasts as an assertive alert and does not auto-dismiss", async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "Show error" }).click();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save link");

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Couldn't save link")).toBeInTheDocument();

    vi.useRealTimers();
  });
});

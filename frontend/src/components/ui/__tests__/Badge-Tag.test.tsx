import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "../Badge";
import { Tag } from "../Tag";

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge>research</Badge>);
    expect(screen.getByText("research")).toBeInTheDocument();
  });
});

describe("Tag", () => {
  it("renders without a remove control by default", () => {
    render(<Tag>pricing</Tag>);
    expect(screen.getByText("pricing")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders an accessible remove button and fires onRemove", async () => {
    const onRemove = vi.fn();
    render(<Tag onRemove={onRemove}>pricing</Tag>);
    const removeButton = screen.getByRole("button", { name: "Remove tag: pricing" });
    await userEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("supports a custom accessible label for the remove button", () => {
    render(
      <Tag onRemove={() => {}} removeLabel="Remove pricing tag">
        pricing
      </Tag>,
    );
    expect(screen.getByRole("button", { name: "Remove pricing tag" })).toBeInTheDocument();
  });
});

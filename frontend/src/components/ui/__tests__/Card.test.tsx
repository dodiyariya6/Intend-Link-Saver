import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Card, CardBody, CardFooter, CardHeader } from "../Card";

describe("Card", () => {
  it("renders composed header/body/footer content", () => {
    render(
      <Card>
        <CardHeader>Header content</CardHeader>
        <CardBody>Body content</CardBody>
        <CardFooter>Footer content</CardFooter>
      </Card>,
    );
    expect(screen.getByText("Header content")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByText("Footer content")).toBeInTheDocument();
  });

  it("is clickable and keyboard-invokable when interactive + given a role", async () => {
    const onClick = vi.fn();
    render(
      <Card interactive role="button" tabIndex={0} onClick={onClick}>
        Clickable card
      </Card>,
    );
    const card = screen.getByRole("button", { name: "Clickable card" });
    await userEvent.click(card);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

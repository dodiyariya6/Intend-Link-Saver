import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Heading, Text } from "../Typography";

describe("Heading", () => {
  it("renders the correct semantic tag per level by default", () => {
    render(<Heading level="h1">Dashboard</Heading>);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("allows overriding the semantic tag independently of visual level", () => {
    render(
      <Heading level="display" as="h2">
        Welcome
      </Heading>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Welcome" })).toBeInTheDocument();
  });
});

describe("Text", () => {
  it("renders body text by default as a paragraph", () => {
    render(<Text>Some body copy</Text>);
    const el = screen.getByText("Some body copy");
    expect(el.tagName).toBe("P");
  });

  it("renders caption/label variants as inline spans by default", () => {
    render(<Text variant="caption">saved 3 days ago</Text>);
    expect(screen.getByText("saved 3 days ago").tagName).toBe("SPAN");
  });
});

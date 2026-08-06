import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Input } from "../Input";
import { TextArea } from "../TextArea";

describe("Input", () => {
  it("associates its label via htmlFor/id", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("accepts typed input", async () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    await userEvent.type(input, "user@example.com");
    expect(input).toHaveValue("user@example.com");
  });

  it("marks aria-invalid and associates the error message when error is set", () => {
    render(<Input label="Email" error="Invalid email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription("Invalid email");
  });

  it("shows helper text when there is no error", () => {
    render(<Input label="URL" helperText="Must be a valid http(s) URL" />);
    expect(screen.getByText("Must be a valid http(s) URL")).toBeInTheDocument();
  });
});

describe("TextArea", () => {
  it("associates its label and accepts multiline input", async () => {
    render(<TextArea label="Note" />);
    const textarea = screen.getByLabelText("Note");
    await userEvent.type(textarea, "Saving for later");
    expect(textarea).toHaveValue("Saving for later");
  });

  it("marks aria-invalid when error is set", () => {
    render(<TextArea label="Note" error="Too long" />);
    expect(screen.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true");
  });
});

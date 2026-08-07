import { describe, expect, it } from "vitest";

import { validateConfirmPassword, validateEmail, validatePassword } from "../validation";

describe("validateEmail", () => {
  it("rejects empty", () => {
    expect(validateEmail("")).toBe("Email is required");
  });
  it("rejects malformed addresses", () => {
    expect(validateEmail("not-an-email")).toMatch(/valid email/);
  });
  it("accepts a well-formed address", () => {
    expect(validateEmail("user@example.com")).toBeUndefined();
  });
});

describe("validatePassword", () => {
  it("rejects empty", () => {
    expect(validatePassword("")).toBe("Password is required");
  });
  it("rejects short passwords", () => {
    expect(validatePassword("short")).toMatch(/at least 8/);
  });
  it("accepts 8+ characters", () => {
    expect(validatePassword("supersecret123")).toBeUndefined();
  });
});

describe("validateConfirmPassword", () => {
  it("rejects empty confirmation", () => {
    expect(validateConfirmPassword("password123", "")).toMatch(/confirm/);
  });
  it("rejects mismatched confirmation", () => {
    expect(validateConfirmPassword("password123", "different")).toMatch(/do not match/);
  });
  it("accepts a matching confirmation", () => {
    expect(validateConfirmPassword("password123", "password123")).toBeUndefined();
  });
});

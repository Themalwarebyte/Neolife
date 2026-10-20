import { describe, expect, it } from "vitest";
import { isValidOfficeEmail, isValidOfficePassword, normalizeOfficeEmail, officePasswordMismatch } from "../src/lib/office-form-validation";

describe("Office authentication field validation", () => {
  it("normalizes email casing and whitespace", () => {
    expect(normalizeOfficeEmail("  Staff@Example.COM  ")).toBe("staff@example.com");
  });
  it("rejects invalid emails and accepts ordinary work email", () => {
    expect(isValidOfficeEmail("staff@example.com")).toBe(true);
    expect(isValidOfficeEmail("not an email")).toBe(false);
    expect(isValidOfficeEmail("no-at-sign")).toBe(false);
  });
  it("enforces password length boundaries for a new password", () => {
    expect(isValidOfficePassword("1234567")).toBe(false);
    expect(isValidOfficePassword("12345678")).toBe(true);
    expect(isValidOfficePassword("x".repeat(128))).toBe(true);
    expect(isValidOfficePassword("x".repeat(129))).toBe(false);
  });
  it("does not mistake different passwords for a match", () => {
    expect(officePasswordMismatch("Password1!", "Password1!")).toBe(false);
    expect(officePasswordMismatch("Password1!", "Password2!")).toBe(true);
  });
});

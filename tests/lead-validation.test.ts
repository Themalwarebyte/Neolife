import { describe, expect, it } from "vitest";
import { parseLeadInput, normalizePhone } from "../src/lib/leads";

const validInput = {
  firstName: "  Jane  ",
  lastName: "Doe",
  phone: "+254 700-123 456",
  email: "jane@example.com",
  city: "Nairobi",
  interestType: "BUSINESS",
  consent: true,
};

describe("parseLeadInput (server-side validation)", () => {
  it("accepts and normalizes a valid submission", () => {
    const result = parseLeadInput(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.firstName).toBe("Jane");
      expect(result.data.phone).toBe("+254700123456");
      expect(result.data.interestType).toBe("BUSINESS");
    }
  });

  it("normalizes phone numbers without +", () => {
    expect(normalizePhone("0700 123 456")).toBe("0700123456");
    expect(normalizePhone("+254 (700) 123-456")).toBe("+254700123456");
  });

  it("rejects missing consent", () => {
    const result = parseLeadInput({ ...validInput, consent: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.consent).toBeTruthy();
  });

  it("rejects missing/short firstName", () => {
    const result = parseLeadInput({ ...validInput, firstName: "J" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.firstName).toBeTruthy();
  });

  it("rejects missing phone", () => {
    const result = parseLeadInput({ ...validInput, phone: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.phone).toBeTruthy();
  });

  it("rejects invalid phone characters", () => {
    const result = parseLeadInput({ ...validInput, phone: "not-a-phone" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = parseLeadInput({ ...validInput, email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.email).toBeTruthy();
  });

  it("rejects invalid interestType", () => {
    const result = parseLeadInput({ ...validInput, interestType: "FREE_MONEY" });
    expect(result.ok).toBe(false);
  });

  it("rejects oversized input", () => {
    const result = parseLeadInput({
      ...validInput,
      firstName: "x".repeat(200),
    });
    expect(result.ok).toBe(false);
  });

  it("silently rejects honeypot submissions", () => {
    const result = parseLeadInput({ ...validInput, website: "http://spam.example" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("");
  });
});

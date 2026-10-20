import { describe, expect, it } from "vitest";
import { getCountries, validateCountryPhone } from "../src/lib/phone-country";
import { parseLeadInput } from "../src/lib/leads";

const lead = {
  firstName: "Jane",
  phone: "0700123456",
  phoneCountry: "KE",
  interestType: "PRODUCT",
  consent: true,
};

describe("country-aware lead phone validation", () => {
  it("includes global calling-code regions and territories", () => {
    const countries = getCountries();
    expect(countries.length).toBeGreaterThan(220);
    for (const code of ["KE", "US", "GB", "IN", "DE", "AU", "CA", "ZA"]) {
      expect(countries).toContain(code);
    }
  });

  it("normalizes a Kenyan local number to E.164", () => {
    const result = validateCountryPhone("KE", "0700 123 456");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.e164).toBe("+254700123456");
  });

  it("accepts valid United States and Indian numbering formats", () => {
    const us = validateCountryPhone("US", "202 555 0123");
    const india = validateCountryPhone("IN", "9876543210");
    expect(us.ok).toBe(true);
    expect(india.ok).toBe(true);
    if (us.ok) expect(us.e164).toBe("+12025550123");
    if (india.ok) expect(india.e164).toBe("+919876543210");
  });

  it("rejects invalid local length, junk and missing country", () => {
    for (const [country, number] of [
      ["KE", "0700123"],
      ["KE", "hello"],
      ["KE", "+254700123456"],
      ["ZZ", "0700123456"],
    ]) {
      expect(validateCountryPhone(country, number).ok).toBe(false);
    }
  });

  it("validates the stored number using the selected country", () => {
    const result = parseLeadInput(lead);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.phone).toBe("+254700123456");
  });

  it("rejects an invalid national number on the server", () => {
    const result = parseLeadInput({ ...lead, phone: "0700" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.phone).toBeTruthy();
  });
});

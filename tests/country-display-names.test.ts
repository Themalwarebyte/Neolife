import { describe, expect, it } from "vitest";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import { COUNTRY_ENGLISH_NAMES } from "../src/lib/country-display-names";

describe("stable country names for SSR and browser hydration", () => {
  it("covers every numbering-plan country with a fixed nonempty English name", () => {
    const codes = getCountries();
    expect(codes.length).toBeGreaterThan(200);
    for (const code of codes) {
      expect(typeof COUNTRY_ENGLISH_NAMES[code]).toBe("string");
      expect(COUNTRY_ENGLISH_NAMES[code].trim().length).toBeGreaterThan(1);
      expect(Number(getCountryCallingCode(code))).toBeGreaterThan(0);
    }
  });

  it("uses deterministic display names for countries that differ by ICU version", () => {
    expect(COUNTRY_ENGLISH_NAMES.FK).toBe("Falkland Islands");
    expect(COUNTRY_ENGLISH_NAMES.KE).toBe("Kenya");
    expect(COUNTRY_ENGLISH_NAMES.UG).toBe("Uganda");
  });
});

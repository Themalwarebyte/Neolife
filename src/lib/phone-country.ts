/**
 * Public lead-capture country-aware phone validation.
 * libphonenumber-js/max includes national numbering-plan lengths and patterns,
 * not one assumed length per country. Validation is repeated on the server.
 */
import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

export { getCountries, getCountryCallingCode };
export type { CountryCode };

export type ValidatedPhone =
  | { ok: true; e164: string; country: CountryCode; dialCode: string }
  | { ok: false; error: string; field: "phone" | "phoneCountry" };

export function validateCountryPhone(
  countryInput: unknown,
  nationalInput: unknown,
): ValidatedPhone {
  const country =
    typeof countryInput === "string" ? countryInput.trim().toUpperCase() : "";
  if (!isSupportedCountry(country as CountryCode)) {
    return {
      ok: false,
      field: "phoneCountry",
      error: "Please select a valid country or territory.",
    };
  }

  if (typeof nationalInput !== "string") {
    return { ok: false, field: "phone", error: "Please enter your phone number." };
  }
  const national = nationalInput.trim();
  // Disallow letters, extensions and repeated / embedded plus signs. The
  // dial code is selected separately rather than typed into this field.
  if (!national || national.length > 32 || !/^[\d\s().-]+$/.test(national)) {
    return {
      ok: false,
      field: "phone",
      error: "Enter a phone number without the international dialing code.",
    };
  }

  const selected = country as CountryCode;
  try {
    const parsed = parsePhoneNumberFromString(national, {
      defaultCountry: selected,
      extract: false,
    });
    // A valid number must belong to the selected numbering plan. This matters
    // for shared calling codes (for example +1) and overseas territories.
    const belongsToSelection = parsed?.country === selected ||
      (!parsed?.country && parsed?.getPossibleCountries().includes(selected));
    if (!parsed || !parsed.isValid() || !belongsToSelection) {
      return {
        ok: false,
        field: "phone",
        error: "This number does not match the selected country's numbering rules.",
      };
    }
    return {
      ok: true,
      e164: parsed.number,
      country: selected,
      dialCode: getCountryCallingCode(selected),
    };
  } catch {
    return {
      ok: false,
      field: "phone",
      error: "Please enter a valid telephone number for the selected country.",
    };
  }
}

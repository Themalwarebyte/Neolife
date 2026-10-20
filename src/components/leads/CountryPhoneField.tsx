"use client";

import { useMemo, useState } from "react";
import { COUNTRY_ENGLISH_NAMES } from "@/lib/country-display-names";
import {
  getCountries,
  getCountryCallingCode,
  validateCountryPhone,
  type CountryCode,
} from "@/lib/phone-country";

const fieldClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

// Labels must be identical during server rendering and client hydration.
// Intl.DisplayNames is intentionally NOT used here: Node and browser ICU data
// can disagree (e.g. FK), causing React to regenerate the entire form.
const countries = getCountries()
  .map((code) => ({
    code,
    name: COUNTRY_ENGLISH_NAMES[code] || code,
    dialCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => {
    const left = a.name.toLowerCase();
    const right = b.name.toLowerCase();
    // Use code-unit comparisons rather than host-specific locale collation.
    return left < right ? -1 : left > right ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });

export function CountryPhoneField({
  errors,
  pending,
}: {
  errors?: Record<string, string>;
  pending: boolean;
}) {
  const [country, setCountry] = useState<CountryCode>("KE");
  const [search, setSearch] = useState("");
  const [national, setNational] = useState("");
  const [touched, setTouched] = useState(false);

  const chosen = countries.find((entry) => entry.code === country);
  const visibleCountries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return countries;
    const filtered = countries.filter((entry) =>
      `${entry.name} ${entry.code} +${entry.dialCode}`.toLowerCase().includes(query),
    );
    // The selected value must remain an option while a search is active.
    if (!filtered.some((entry) => entry.code === country) && chosen) {
      return [chosen, ...filtered];
    }
    return filtered;
  }, [search, country, chosen]);

  const checked = touched ? validateCountryPhone(country, national) : null;
  const clientError = checked && !checked.ok ? checked.error : null;
  const phoneError = errors?.phone || clientError;

  return (
    <div className="sm:col-span-2">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div>
          <label htmlFor="phoneCountry" className="block text-sm font-semibold text-neutral-800">
            Country or territory <span aria-hidden="true">*</span>
          </label>
          <input
            id="countrySearch"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={pending}
            autoComplete="off"
            placeholder="Search country or dial code"
            aria-label="Search countries"
            className={`mt-1.5 mb-2 ${fieldClass}`}
          />
          <select
            id="phoneCountry"
            name="phoneCountry"
            value={country}
            onChange={(event) => {
              setCountry(event.target.value as CountryCode);
              setTouched(false);
              setSearch("");
            }}
            disabled={pending}
            required
            className={fieldClass}
            aria-invalid={Boolean(errors?.phoneCountry)}
            aria-describedby={errors?.phoneCountry ? "phoneCountry-error" : undefined}
          >
            {visibleCountries.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.name} (+{entry.dialCode})
              </option>
            ))}
          </select>
          {errors?.phoneCountry ? (
            <p id="phoneCountry-error" role="alert" className="mt-1.5 text-sm text-red-600">
              {errors.phoneCountry}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-neutral-800">
            Phone number <span aria-hidden="true">*</span>
          </label>
          <div className="mt-1.5 flex overflow-hidden rounded-xl border border-neutral-200 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
            <span className="flex shrink-0 items-center border-r border-neutral-200 bg-cream-50 px-3 text-sm font-semibold text-forest-800">
              +{chosen?.dialCode || ""}
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              maxLength={32}
              value={national}
              onChange={(event) => setNational(event.target.value)}
              onBlur={() => setTouched(true)}
              disabled={pending}
              placeholder="Local phone number"
              className="w-full min-w-0 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              aria-invalid={Boolean(phoneError)}
              aria-describedby={phoneError ? "phone-error" : "phone-help"}
            />
          </div>
          {phoneError ? (
            <p id="phone-error" role="alert" className="mt-1.5 text-sm font-medium text-red-600">
              {phoneError}
            </p>
          ) : (
            <p id="phone-help" className="mt-1.5 text-xs text-neutral-500">
              Enter the number after the country code. Local prefixes are supported.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

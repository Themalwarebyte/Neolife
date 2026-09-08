"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { submitLeadAction, type SubmitLeadResult } from "@/app/actions/lead";
import { CtaLink } from "@/components/ui/CtaLink";
import {
  ATTRIBUTION_STORAGE_KEY,
  deserializeAttribution,
  type Attribution,
} from "@/lib/attribution";

const fieldClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
const labelClass = "block text-sm font-semibold text-neutral-800";
const errorClass = "mt-1.5 text-sm font-medium text-red-600";

/**
 * Public lead-capture form (Task 1.5).
 * Client-side validation is UX only — all validation is enforced server-side
 * by `submitLeadAction`. Attribution is intentionally out of scope (Task 1.4).
 */
export function LeadForm() {
  const [state, formAction, pending] = useActionState<
    SubmitLeadResult | null,
    FormData
  >(submitLeadAction, null);

  // Task 1.4 — first-touch attribution captured earlier on this device
  // (first-party localStorage). Values are re-validated server-side.
  const [attribution, setAttribution] = useState<Attribution>({});
  useEffect(() => {
    try {
      setAttribution(
        deserializeAttribution(
          window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY),
        ) ?? {},
      );
    } catch {
      setAttribution({});
    }
  }, []);

  if (state?.status === "success") {
    return (
      <div
        role="status"
        className="rounded-3xl border border-brand-500/30 bg-brand-50 p-8 text-center"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-2xl text-white"
        >
          ✓
        </span>
        <h2 className="mt-4 text-xl font-bold text-neutral-900">
          Interest registered
        </h2>
        <p className="mt-2 text-neutral-600">{state.message}</p>
        <p className="mt-4 text-sm text-neutral-500">
          Results vary. No income or business results are guaranteed.
        </p>
        <div className="mt-6">
          <CtaLink href="/" variant="secondary" size="md">
            Back to home
          </CtaLink>
        </div>
      </div>
    );
  }

  const errors = state?.status === "error" ? state.fieldErrors : undefined;
  const formError = state?.status === "error" ? state.message : undefined;

  return (
    <form action={formAction} noValidate className="space-y-5">
      {/* Honeypot — hidden from users, catches naive bots */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Task 1.4 — first-touch attribution (hidden, server-revalidated) */}
      {attribution.source ? (
        <input type="hidden" name="utmSource" value={attribution.source} />
      ) : null}
      {attribution.medium ? (
        <input type="hidden" name="utmMedium" value={attribution.medium} />
      ) : null}
      {attribution.campaign ? (
        <input type="hidden" name="utmCampaign" value={attribution.campaign} />
      ) : null}
      {attribution.content ? (
        <input type="hidden" name="utmContent" value={attribution.content} />
      ) : null}
      {attribution.term ? (
        <input type="hidden" name="utmTerm" value={attribution.term} />
      ) : null}
      {attribution.landingPage ? (
        <input
          type="hidden"
          name="landingPage"
          value={attribution.landingPage}
        />
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={labelClass}>
            First name <span aria-hidden="true">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            autoComplete="given-name"
            maxLength={80}
            className={`mt-1.5 ${fieldClass}`}
            aria-invalid={Boolean(errors?.firstName)}
            aria-describedby={errors?.firstName ? "firstName-error" : undefined}
          />
          {errors?.firstName ? (
            <p id="firstName-error" className={errorClass} role="alert">
              {errors.firstName}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="lastName" className={labelClass}>
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            maxLength={80}
            className={`mt-1.5 ${fieldClass}`}
          />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone <span aria-hidden="true">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            maxLength={24}
            placeholder="+254 7XX XXX XXX"
            className={`mt-1.5 ${fieldClass}`}
            aria-invalid={Boolean(errors?.phone)}
            aria-describedby={errors?.phone ? "phone-error" : undefined}
          />
          {errors?.phone ? (
            <p id="phone-error" className={errorClass} role="alert">
              {errors.phone}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={160}
            className={`mt-1.5 ${fieldClass}`}
            aria-invalid={Boolean(errors?.email)}
            aria-describedby={errors?.email ? "email-error" : undefined}
          />
          {errors?.email ? (
            <p id="email-error" className={errorClass} role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className={labelClass}>
            City / area
          </label>
          <input
            id="city"
            name="city"
            autoComplete="address-level2"
            maxLength={80}
            placeholder="e.g. Nairobi"
            className={`mt-1.5 ${fieldClass}`}
          />
        </div>
        <div>
          <label htmlFor="interestType" className={labelClass}>
            I am interested in <span aria-hidden="true">*</span>
          </label>
          <select
            id="interestType"
            name="interestType"
            required
            defaultValue=""
            className={`mt-1.5 ${fieldClass}`}
            aria-invalid={Boolean(errors?.interestType)}
            aria-describedby={
              errors?.interestType ? "interestType-error" : undefined
            }
          >
            <option value="" disabled>
              Please choose…
            </option>
            <option value="BUSINESS">The business opportunity</option>
            <option value="PRODUCT">The products</option>
            <option value="BOTH">Both the business and the products</option>
            <option value="UNSURE">Not sure yet — tell me more</option>
          </select>
          {errors?.interestType ? (
            <p id="interestType-error" className={errorClass} role="alert">
              {errors.interestType}
            </p>
          ) : null}
        </div>
      </div>
      <div>
        <div className="flex items-start gap-3 rounded-xl bg-neutral-50 p-4">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-describedby={errors?.consent ? "consent-error" : "consent-help"}
          />
          <div>
            <label
              htmlFor="consent"
              className="text-sm font-semibold text-neutral-800"
            >
              I am happy for the NEOLIFE office team to contact me about this
              opportunity <span aria-hidden="true">*</span>
            </label>
            <p id="consent-help" className="mt-1 text-sm text-neutral-500">
              Your details are used only to respond to your enquiry. See our{" "}
              <a href="/privacy" className="font-medium text-brand-700 underline">
                Privacy Notice
              </a>
              ,{" "}
              <a href="/terms" className="font-medium text-brand-700 underline">
                Terms
              </a>{" "}
              and{" "}
              <a
                href="/disclosures"
                className="font-medium text-brand-700 underline"
              >
                Disclosures
              </a>
              .
            </p>
          </div>
        </div>
        {errors?.consent ? (
          <p id="consent-error" className={errorClass} role="alert">
            {errors.consent}
          </p>
        ) : null}
      </div>
      {formError ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col items-start gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-sm shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Submitting…" : "Submit My Interest"}
        </button>
        <p className="text-sm text-neutral-500">
          {pending
            ? "Submitting takes a moment — please click once."
            : "We only use your details to respond to your enquiry."}
        </p>
      </div>





    </form>
  );
}

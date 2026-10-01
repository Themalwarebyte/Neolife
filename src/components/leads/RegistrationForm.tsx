"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { registerInterestAction, type RegisterInterestResult } from "@/app/actions/register-interest";
import { recordFunnelEventClient } from "@/lib/funnel-client";
import { getOrCreateDeviceId } from "@/lib/funnel-device";

const fieldClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
const labelClass = "block text-sm font-semibold text-neutral-800";
const errorClass = "mt-1.5 text-sm font-medium text-red-600";

export type SelectableProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
};

interface RegistrationFormProps {
  token: string;
  products: SelectableProduct[];
}

/**
 * Phase P-1 — optional registration / business-interest form (D-026).
 *
 * Presented alongside the qualification form on the post-capture qualify page.
 * The prospect selects a product they are interested in, indicates a preferred
 * meeting format, and may add context. The server action validates the
 * qualification token (non-consuming) to authorize the lead, then persists a
 * ProductInterest row and records the registration_complete FunnelEvent.
 *
 * `registration_start` is emitted client-side when this form is first displayed,
 * representing entry into the registration step (consistent with
 * `visitor_landing` semantics). `registration_complete` is server-side only.
 *
 * Authorization is via the token only — the leadId is never taken from
 * client form input.
 */
export function RegistrationForm({ token, products }: RegistrationFormProps) {
  const [state, action, pending] = useActionState<
    RegisterInterestResult | null,
    FormData
  >(registerInterestAction, null);

  // Phase P-1 — emit registration_start once when the form first mounts.
  // This represents entry into the registration step (client-side, anonymous,
  // non-PII deviceId only — consistent with visitor_landing semantics).
  // Uses the same device correlation as FunnelTracker (first-party localStorage
  // UUID, no cookies/IP/User-Agent). Failure is silently ignored — funnel
  // tracking must never break the form.
  useEffect(() => {
    void emitRegistrationStart();
  }, []);

  async function emitRegistrationStart() {
    try {
      const deviceId = getOrCreateDeviceId();
      if (!deviceId) return;
      await recordFunnelEventClient({
        type: "registration_start",
        deviceId,
        metadata: { form: "register-interest-qualify" },
      });
    } catch {
      // Funnel tracking must never break the form.
    }
  }

  const formError = state?.status === "error" ? state.message : undefined;

  if (products.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No products are currently available. Please try again later.
      </p>
    );
  }

  return (
    <form action={action} noValidate>
      <input type="hidden" name="token" value={token} />

      {formError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {formError}
        </p>
      ) : null}

      {state?.status === "success" ? (
        <div
          role="status"
          className="rounded-3xl border border-brand-500/30 bg-brand-50 p-6 text-center"
        >
          <span
            aria-hidden="true"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-xl text-white"
          >
            ✓
          </span>
          <h3 className="mt-3 text-lg font-bold text-neutral-900">
            Interest recorded
          </h3>
          <p className="mt-2 text-sm text-neutral-600">{state.message}</p>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <label htmlFor="productId" className={labelClass}>
              Product I am most interested in *
            </label>
            <p className="mt-1 text-sm text-neutral-500">
              Select the product you would like to learn more about.
            </p>
            <select
              id="productId"
              name="productId"
              defaultValue=""
              className={`mt-1.5 ${fieldClass}`}
              disabled={pending}
            >
              <option value="" disabled>
                Choose a product…
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (SKU: {product.slug})
                </option>
              ))}
            </select>
            {state?.fieldErrors?.productId ? (
              <p className={errorClass}>{state.fieldErrors.productId}</p>
            ) : null}
          </div>

          <div className="mb-5">
            <label className={labelClass}>Preferred meeting format *</label>
            <p className="mt-1 text-sm text-neutral-500">
              How would you prefer to meet with our team?
            </p>
            <div className="mt-2 space-y-2">
              {[
                { value: "video_call", label: "Video call" },
                { value: "in_person", label: "In-person at the office" },
                { value: "phone_call", label: "Phone call" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3"
                >
                  <input
                    type="radio"
                    name="meetingPreference"
                    value={option.value}
                    defaultChecked={false}
                    disabled={pending}
                    className="h-4 w-4 border-neutral-300 text-brand-600 focus:ring-brand-500"
                    required
                  />
                  <span className="text-sm text-neutral-700">{option.label}</span>
                </label>
              ))}
            </div>
            {state?.fieldErrors?.meetingPreference ? (
              <p className={errorClass}>{state.fieldErrors.meetingPreference}</p>
            ) : null}
          </div>

          <div className="mb-5">
            <label htmlFor="additionalContext" className={labelClass}>
              Additional context
            </label>
            <p className="mt-1 text-sm text-neutral-500">
              Tell us more about your interest, specific questions, or anything
              else our team should know.
            </p>
            <textarea
              id="additionalContext"
              name="additionalContext"
              maxLength={1000}
              rows={4}
              placeholder="e.g. I'd like to know about the business opportunity..."
              className={`${fieldClass} resize-y`}
              disabled={pending}
            />
            {state?.fieldErrors?.additionalContext ? (
              <p className={errorClass}>{state.fieldErrors.additionalContext}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-sm shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Record my interest"}
          </button>
        </>
      )}
    </form>
  );
}

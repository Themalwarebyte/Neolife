"use client";

import { useActionState, useEffect, useState } from "react";
import { qualifyLeadAction, type QualifyResult } from "@/app/actions/qualify";
import { isTokenStructurallyValid } from "@/lib/qualification-client";

const fieldClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
const labelClass = "block text-sm font-semibold text-neutral-800";

type TokenValidationState =
  | { status: "loading" }
  | { status: "valid"; leadId: string }
  | { status: "invalid"; message: string };

/**
 * Phase D — qualification form (D-030).
 *
 * Validates the continuation token client-side for UX (shows error immediately),
 * but the token is RE-VALIDATED server-side in the qualifyLeadAction.
 * The client cannot bypass the server-side check.
 */
export function QualificationForm({ token }: { token: string }) {
  const [tokenState, setTokenState] = useState<TokenValidationState>({
    status: "loading",
  });

  // Validate token for UX only (server re-validates on submission).
  useEffect(() => {
    void validateToken();
  }, [token]);

  async function validateToken() {
    if (!token) {
      setTokenState({
        status: "invalid",
        message: "No qualification link was provided.",
      });
      return;
    }

    // Client-side structural check for UX only.
    // The server re-validates the token (signature, DB nonce, expiration)
    // in the qualifyLeadAction — this check is purely informational.
    if (isTokenStructurallyValid(token)) {
      setTokenState({ status: "valid", leadId: token });
    } else {
      setTokenState({
        status: "invalid",
        message:
          "This qualification link is invalid, has expired, or has already been used.",
      });
    }
  }

  const [state, action, pending] = useActionState<QualifyResult | null, FormData>(
    qualifyLeadAction,
    null,
  );

  if (tokenState.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-200" />
      </div>
    );
  }

  if (tokenState.status === "invalid") {
    return (
      <div className="text-center">
        <p className="text-sm text-neutral-600">{tokenState.message}</p>
        <div className="mt-6">
          <a
            href="/register-interest"
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-7 py-3 text-base font-semibold text-white shadow-sm shadow-brand-600/20 transition-colors hover:bg-brand-700"
          >
            Register interest again
          </a>
        </div>
      </div>
    );
  }

  const formError = state?.status === "error" ? state.message : undefined;

  return (
    <form action={action} noValidate>
      {/* Token is submitted to the server action — server re-validates. */}
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
            Qualification recorded
          </h3>
          <p className="mt-2 text-sm text-neutral-600">{state.message}</p>
          <div className="mt-6">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-2.5 text-base font-semibold text-white shadow-sm shadow-brand-600/20 transition-colors hover:bg-brand-700"
            >
              Back to home
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <label htmlFor="interestType" className={labelClass}>
              I am most interested in…
            </label>
            <p className="mt-1 text-sm text-neutral-500">
              You can refine the interest you selected when you registered.
            </p>
            <select
              id="interestType"
              name="interestType"
              defaultValue=""
              className={`mt-1.5 ${fieldClass}`}
            >
              <option value="" disabled>
                Keep my original selection
              </option>
              <option value="BUSINESS">The business opportunity</option>
              <option value="PRODUCT">The products</option>
              <option value="BOTH">Both the business and the products</option>
              <option value="UNSURE">I'm still not sure</option>
            </select>
          </div>

          <div className="mb-5">
            <label htmlFor="city" className={labelClass}>
              City / area
            </label>
            <input
              id="city"
              name="city"
              type="text"
              maxLength={80}
              placeholder="e.g. Nairobi"
              className={fieldClass}
            />
          </div>

          <div className="mb-5">
            <label htmlFor="notes" className={labelClass}>
              Your questions or notes
            </label>
            <p className="mt-1 text-sm text-neutral-500">
              Tell us what you'd like to know — about the business opportunity,
              the products, or next steps.
            </p>
            <textarea
              id="notes"
              name="notes"
              maxLength={500}
              rows={4}
              placeholder="e.g. I'd like to know about the business model..."
              className={`${fieldClass} resize-y`}
            />
          </div>

          {formError ? (
            <p role="alert" className="mb-4 text-sm font-medium text-red-600">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-sm shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Submit qualification"}
          </button>
          <p className="mt-3 text-xs text-neutral-500">
            This is optional. You can skip qualification and return home.
            Your details are already registered.
          </p>
        </>
      )}
    </form>
  );
}

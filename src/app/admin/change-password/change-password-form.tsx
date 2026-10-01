"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/app/admin/(protected)/actions";
import type { CrmActionResult } from "@/app/admin/(protected)/actions";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    CrmActionResult | null,
    FormData
  >(changePasswordAction, null);

  useEffect(() => {
    if (state?.status === "success") {
      router.push("/admin/leads");
    }
  }, [state, router]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/admin/leads")}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            &larr; Back to CRM
          </button>
          <h1 className="mt-4 text-3xl font-bold text-neutral-900">
            Change password
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            You must change your password before continuing.
          </p>
        </div>

        {state?.status === "error" ? (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {state.message}
          </p>
        ) : null}

        <form action={formAction} className="space-y-5">
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-semibold text-neutral-800"
            >
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-semibold text-neutral-800"
            >
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-semibold text-neutral-800"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save new password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

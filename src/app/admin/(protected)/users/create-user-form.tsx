"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createCrmUser } from "../actions";
import type { CrmActionResult } from "../actions";

export default function CreateUserForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    CrmActionResult | null,
    FormData
  >(createCrmUser, null);

  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    if (state?.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-800">Create new user</h2>
      {state?.status === "error" ? (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.message}
        </p>
      ) : state?.status === "success" ? (
        <p
          role="status"
          className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
        >
          {state.message}
        </p>
      ) : null}
      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-neutral-700"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-neutral-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-neutral-700"
          >
            Temporary password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={passwordVisible ? "text" : "password"}
              required
              minLength={8}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 pr-12 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setPasswordVisible(!passwordVisible)}
              className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-neutral-500 hover:text-neutral-700"
            >
              {passwordVisible ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Minimum 8 characters. User must change this on first login.
          </p>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isPending ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}

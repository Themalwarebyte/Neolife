"use client";

import { useActionState } from "react";
import {
  addFollowUp,
  type CrmActionResult,
} from "@/app/admin/(protected)/actions";

export function FollowUpForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    addFollowUp,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={leadId} />
      <label htmlFor="note" className="text-sm font-semibold text-neutral-800">
        Add follow-up note
      </label>
      <textarea
        id="note"
        name="note"
        rows={3}
        maxLength={2000}
        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        placeholder="e.g. Called — will attend office meeting next week."
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-neutral-900 px-5 py-2.5 font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
        {state?.message ? (
          <p
            role="status"
            className={`text-sm ${state.status === "success" ? "text-brand-700" : "text-red-600"}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

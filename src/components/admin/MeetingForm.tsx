"use client";

import { useActionState } from "react";
import {
  scheduleMeeting,
  type CrmActionResult,
} from "@/app/admin/(protected)/actions";

export function MeetingForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    scheduleMeeting,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="scheduledAt" className="text-sm font-semibold text-neutral-800">
            Date &amp; time
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div>
          <label htmlFor="meeting-notes" className="text-sm font-semibold text-neutral-800">
            Notes
          </label>
          <input
            id="meeting-notes"
            name="notes"
            maxLength={500}
            placeholder="e.g. Office, bring questions"
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Scheduling…" : "Schedule meeting"}
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

"use client";

import { useActionState } from "react";
import {
  updateMeeting,
  type CrmActionResult,
} from "@/app/admin/(protected)/actions";
import { VALID_MEETING_STATUSES } from "@/lib/meetingManagement";

export function MeetingUpdateForm({
  meetingId,
  currentStatus,
  outcome,
  notes,
}: {
  meetingId: string;
  currentStatus: string;
  outcome: string | null;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    updateMeeting,
    null,
  );

  return (
    <form action={action} className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
      <input type="hidden" name="meetingId" value={meetingId} />
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          name="status"
          defaultValue={currentStatus}
          aria-label="Meeting status"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {VALID_MEETING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <input
          name="outcome"
          defaultValue={outcome ?? ""}
          maxLength={500}
          placeholder="Outcome"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          name="notes"
          defaultValue={notes ?? ""}
          maxLength={500}
          placeholder="Notes"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Update"}
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

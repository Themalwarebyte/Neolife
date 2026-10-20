"use client";

import { useActionState, useState } from "react";
import { addFollowUp, type CrmActionResult } from "@/app/admin/(protected)/actions";

/** Browser local datetime -> UTC before server validation, irrespective of office TZ. */
export function FollowUpForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    addFollowUp,
    null,
  );
  const [dueLocal, setDueLocal] = useState("");
  const dueAtIso = dueLocal && Number.isFinite(new Date(dueLocal).getTime())
    ? new Date(dueLocal).toISOString()
    : "";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={leadId} />
      <input type="hidden" name="dueAtIso" value={dueLocal ? dueAtIso : ""} />
      <div>
        <label htmlFor={`note-${leadId}`} className="text-sm font-semibold text-neutral-800">
          Follow-up note or task
        </label>
        <textarea
          id={`note-${leadId}`}
          name="note"
          required
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          placeholder="e.g. Call about the business presentation and confirm meeting time."
        />
      </div>
      <div>
        <label htmlFor={`due-${leadId}`} className="block text-sm font-semibold text-neutral-800">
          Schedule next follow-up (optional)
        </label>
        <input
          id={`due-${leadId}`}
          type="datetime-local"
          value={dueLocal}
          onChange={(event) => setDueLocal(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Uses your local time. Leave empty to save an ordinary note; scheduling does not send an email.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || Boolean(dueLocal && !dueAtIso)}
          className="rounded-xl bg-mulberry-700 px-5 py-2.5 font-semibold text-white hover:bg-mulberry-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : dueLocal ? "Schedule follow-up" : "Save note"}
        </button>
        {state?.message ? (
          <p role="status" className={`text-sm ${state.status === "success" ? "text-brand-700" : "text-red-600"}`}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

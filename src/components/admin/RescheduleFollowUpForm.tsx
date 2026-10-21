"use client";

import { useActionState, useState } from "react";
import { rescheduleFollowUp, type CrmActionResult } from "@/app/admin/(protected)/actions";

export function RescheduleFollowUpForm({ id, dueAtIso }: { id: string; dueAtIso: string }) {
  const [result, action, pending] = useActionState<CrmActionResult | null, FormData>(rescheduleFollowUp, null);
  const [localTime, setLocalTime] = useState("");
  const nextIso = localTime && Number.isFinite(new Date(localTime).getTime())
    ? new Date(localTime).toISOString()
    : "";
  const controlId = `reschedule-${id}`;

  return <details className="mt-2 group text-sm">
    <summary className="cursor-pointer font-semibold text-mulberry-700 hover:underline">Reschedule</summary>
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="followUpId" value={id} />
      <input type="hidden" name="expectedDueAt" value={dueAtIso} />
      <input type="hidden" name="dueAtIso" value={nextIso} />
      <div>
        <label htmlFor={controlId} className="block text-xs font-semibold text-neutral-700">New local date and time</label>
        <input id={controlId} type="datetime-local" required value={localTime}
          onChange={event => setLocalTime(event.target.value)}
          className="mt-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={pending || !nextIso}
        className="rounded-lg bg-mulberry-700 px-4 py-2 text-sm font-semibold text-white hover:bg-mulberry-800 disabled:opacity-60">
        {pending ? "Saving…" : "Save new time"}
      </button>
      {result?.message && <p role="status" className={`w-full text-xs ${result.status === "success" ? "text-brand-700" : "text-red-600"}`}>{result.message}</p>}
    </form>
  </details>;
}

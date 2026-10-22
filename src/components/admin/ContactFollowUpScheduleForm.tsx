"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { scheduleContactFollowUp, type ContactProcessingResult } from "@/app/admin/(protected)/my-contacts/processing/actions";

export function ContactFollowUpScheduleForm({ contactId, version, outreachAllowed }:
  { contactId: string; version: number; outreachAllowed: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ContactProcessingResult | null, FormData>(scheduleContactFollowUp, null);
  const [dueLocal, setDueLocal] = useState("");
  const iso = dueLocal && Number.isFinite(new Date(dueLocal).getTime()) ? new Date(dueLocal).toISOString() : "";
  useEffect(() => { if (state?.status === "success") router.refresh(); }, [state, router]);
  return <form action={action} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
    <h2 className="font-bold text-neutral-900">Schedule contact follow-up</h2>
    <p className="text-sm text-neutral-600">This schedules an internal task only. It never sends an email or places a call.</p>
    <input type="hidden" name="contactId" value={contactId} />
    <input type="hidden" name="expectedVersion" value={version} />
    <input type="hidden" name="dueAtIso" value={iso} />
    <label className="block text-sm font-semibold" htmlFor={`follow-kind-${contactId}`}>Task type
      <select id={`follow-kind-${contactId}`} name="kind" required defaultValue="INTERNAL"
        className="mt-1 block w-full rounded-xl border border-neutral-300 p-3 text-sm">
        <option value="INTERNAL">Internal review / preparation</option>
        <option value="CALL" disabled={!outreachAllowed}>Call (requires permission)</option>
        <option value="EMAIL" disabled={!outreachAllowed}>Email (requires permission)</option>
      </select>
    </label>
    {!outreachAllowed && <p className="text-xs font-semibold text-amber-800">Call and email tasks unavailable until documented permission is granted and Do Not Contact is clear.</p>}
    <label className="block text-sm font-semibold" htmlFor={`follow-date-${contactId}`}>Due date and time (your local time)
      <input id={`follow-date-${contactId}`} type="datetime-local" required value={dueLocal} onChange={e => setDueLocal(e.target.value)}
        className="mt-1 block w-full rounded-xl border border-neutral-300 p-3 text-sm" />
    </label>
    <label className="block text-sm font-semibold" htmlFor={`follow-note-${contactId}`}>Task details
      <textarea id={`follow-note-${contactId}`} name="note" required minLength={10} maxLength={2000} rows={3}
        className="mt-1 block w-full rounded-xl border border-neutral-300 p-3 text-sm" placeholder="What must be done, and what permission applies?" />
    </label>
    <button type="submit" disabled={pending || !iso} className="rounded-full bg-mulberry-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {pending ? "Saving…" : "Save follow-up task"}
    </button>
    {state && <p role={state.status === "error" ? "alert" : "status"} className="text-sm">{state.message}</p>}
  </form>;
}

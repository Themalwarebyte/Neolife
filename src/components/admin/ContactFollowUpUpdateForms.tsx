"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changeContactFollowUp, type ContactProcessingResult } from "@/app/admin/(protected)/my-contacts/processing/actions";

export function ContactFollowUpUpdateForms({ taskId, version, allowOutreachUpdate }:
  { taskId: string; version: number; allowOutreachUpdate: boolean }) {
  const router = useRouter();
  const [completeState, complete, completing] = useActionState<ContactProcessingResult | null, FormData>(changeContactFollowUp, null);
  const [cancelState, cancel, cancelling] = useActionState<ContactProcessingResult | null, FormData>(changeContactFollowUp, null);
  const [rescheduleState, reschedule, rescheduling] = useActionState<ContactProcessingResult | null, FormData>(changeContactFollowUp, null);
  const [dueLocal, setDueLocal] = useState("");
  const iso = dueLocal && Number.isFinite(new Date(dueLocal).getTime()) ? new Date(dueLocal).toISOString() : "";
  useEffect(() => {
    if ([completeState, cancelState, rescheduleState].some(s => s?.status === "success")) router.refresh();
  }, [router, completeState, cancelState, rescheduleState]);
  const hidden = <><input type="hidden" name="followUpId" value={taskId} />
    <input type="hidden" name="expectedVersion" value={version} /></>;
  return <div className="grid gap-3 lg:grid-cols-3">
    {allowOutreachUpdate ? <form action={complete} className="space-y-2 rounded-xl border border-neutral-200 p-3">
      {hidden}<input type="hidden" name="action" value="COMPLETE" />
      <label className="block text-xs font-semibold" htmlFor={`task-complete-${taskId}`}>Outcome (required)
        <textarea id={`task-complete-${taskId}`} name="reason" required minLength={10} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
      </label>
      <button type="submit" disabled={completing || cancelling || rescheduling} className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Complete</button>
      {completeState && <p role={completeState.status === "error" ? "alert" : "status"} className="text-xs">{completeState.message}</p>}
    </form> : <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Outreach task paused because permission or active-contact status changed. Cancel it instead.</p>}
    {allowOutreachUpdate ? <form action={reschedule} className="space-y-2 rounded-xl border border-neutral-200 p-3">
      {hidden}<input type="hidden" name="action" value="RESCHEDULE" />
      <input type="hidden" name="dueAtIso" value={iso} />
      <label htmlFor={`task-due-${taskId}`} className="block text-xs font-semibold">New due time
        <input id={`task-due-${taskId}`} type="datetime-local" required value={dueLocal} onChange={e => setDueLocal(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-xs" />
      </label>
      <label htmlFor={`task-reschedule-${taskId}`} className="block text-xs font-semibold">Reason
        <textarea id={`task-reschedule-${taskId}`} name="reason" required minLength={10} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
      </label>
      <button type="submit" disabled={rescheduling || completing || cancelling || !iso} className="rounded-full border border-mulberry-300 px-3 py-2 text-xs font-semibold text-mulberry-800 disabled:opacity-50">Reschedule</button>
      {rescheduleState && <p role={rescheduleState.status === "error" ? "alert" : "status"} className="text-xs">{rescheduleState.message}</p>}
    </form> : null}
    <form action={cancel} className="space-y-2 rounded-xl border border-neutral-200 p-3">
      {hidden}<input type="hidden" name="action" value="CANCEL" />
      <label className="block text-xs font-semibold" htmlFor={`task-cancel-${taskId}`}>Cancellation reason
        <textarea id={`task-cancel-${taskId}`} name="reason" required minLength={10} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
      </label>
      <button type="submit" disabled={cancelling || completing || rescheduling} className="rounded-full border border-neutral-400 px-3 py-2 text-xs font-semibold text-neutral-800 disabled:opacity-50">Cancel task</button>
      {cancelState && <p role={cancelState.status === "error" ? "alert" : "status"} className="text-xs">{cancelState.message}</p>}
    </form>
  </div>;
}

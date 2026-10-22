"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dismissDuplicateIssue, mergeDuplicateIssue, type DuplicateActionResult,
} from "@/app/admin/(protected)/my-contacts/duplicates/actions";

type ContactBrief = { id: string; firstName: string; lastName: string | null; state: string; version: number };

export function ContactDuplicateReviewForm({
  issueId, left, right,
}: { issueId: string; left: ContactBrief; right: ContactBrief }) {
  const router = useRouter();
  const [keepId, setKeepId] = useState(left.id);
  const [mergeResult, merge, merging] = useActionState<DuplicateActionResult | null, FormData>(mergeDuplicateIssue, null);
  const [dismissResult, dismiss, dismissing] = useActionState<DuplicateActionResult | null, FormData>(dismissDuplicateIssue, null);
  const mergeAllowed = left.state === right.state && ["MAIN", "IMPORTED_QUEUE"].includes(left.state);
  useEffect(() => {
    if (mergeResult?.status === "success" && mergeResult.retainedId) {
      router.push(`/admin/my-contacts/${mergeResult.retainedId}`);
    } else if (dismissResult?.status === "success") {
      router.push("/admin/my-contacts?view=duplicates");
    }
  }, [mergeResult, dismissResult, router]);
  const hidden = <>
    <input type="hidden" name="issueId" value={issueId} />
    <input type="hidden" name="leftVersion" value={left.version} />
    <input type="hidden" name="rightVersion" value={right.version} />
  </>;
  return <div className="grid gap-5 lg:grid-cols-2">
    <form action={dismiss} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
      {hidden}
      <h2 className="text-lg font-bold text-neutral-900">Keep separate</h2>
      <p className="text-sm text-neutral-600">These are different people or the evidence is insufficient. The pair will not reappear on future scans.</p>
      <label className="block text-sm font-semibold text-neutral-700" htmlFor="duplicate-dismiss-reason">
        Explanation (required)
        <textarea id="duplicate-dismiss-reason" name="reason" required minLength={10} maxLength={300} rows={3}
          placeholder="For example: This phone number is shared by two family members."
          className="mt-2 w-full rounded-xl border border-neutral-300 p-3 text-sm text-neutral-900" />
      </label>
      <button disabled={dismissing || merging} type="submit"
        className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50">
        {dismissing ? "Saving…" : "Confirm: keep separate"}
      </button>
      {dismissResult && <p role={dismissResult.status === "error" ? "alert" : "status"} className="text-sm">{dismissResult.message}</p>}
    </form>
    <form action={merge} className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
      {hidden}
      <h2 className="text-lg font-bold text-neutral-900">Merge after verification</h2>
      <p className="text-sm text-neutral-700">Choose the contact to retain. The other record remains accessible as a merged source with its original details, import link, and audit history. The retained name, city, source and notes do not change automatically. Do Not Contact and restrictive consent always win.</p>
      {mergeAllowed ? <fieldset className="space-y-2 text-sm">
        <legend className="font-semibold text-neutral-800">Retain which contact?</legend>
        {[left, right].map(c => <label key={c.id} className="flex items-start gap-2">
          <input type="radio" name="keepId" value={c.id} checked={keepId === c.id} onChange={() => setKeepId(c.id)} />
          <span>{c.firstName} {c.lastName || ""} · {c.state} · {c.id.slice(0, 8)}</span>
        </label>)}
      </fieldset> : <p className="rounded-lg bg-white p-3 text-sm font-semibold text-amber-900">Merging is unavailable unless both records are active in the same list (both Main or both Imported Queue). This prevents unreviewed queue contacts being silently promoted.</p>}
      <label htmlFor="duplicate-merge-reason" className="block text-sm font-semibold text-neutral-700">Why are these the same person? (required)
        <textarea id="duplicate-merge-reason" name="reason" required minLength={10} maxLength={300} rows={3} disabled={!mergeAllowed}
          placeholder="State what was independently confirmed before merging."
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm text-neutral-900" />
      </label>
      <button disabled={!mergeAllowed || merging || dismissing} type="submit"
        className="rounded-full bg-mulberry-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {merging ? "Reviewing…" : "Confirm reviewed merge"}
      </button>
      {mergeResult && <p role={mergeResult.status === "error" ? "alert" : "status"} className="text-sm">{mergeResult.message}</p>}
    </form>
  </div>;
}

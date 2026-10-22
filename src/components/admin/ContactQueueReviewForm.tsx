"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { reviewImportedContact, type ContactProcessingResult } from "@/app/admin/(protected)/my-contacts/processing/actions";

export function ContactQueueReviewForm({ contactId, version }: { contactId: string; version: number }) {
  const router = useRouter();
  const [approveResult, approveAction, approving] = useActionState<ContactProcessingResult | null, FormData>(reviewImportedContact, null);
  const [rejectResult, rejectAction, rejecting] = useActionState<ContactProcessingResult | null, FormData>(reviewImportedContact, null);
  useEffect(() => {
    if (approveResult?.status === "success" || rejectResult?.status === "success") router.refresh();
  }, [router, approveResult, rejectResult]);
  const hidden = <><input type="hidden" name="contactId" value={contactId} />
    <input type="hidden" name="expectedVersion" value={version} /></>;
  return <section className="grid gap-4 md:grid-cols-2" aria-label="Imported contact decisions">
    <form action={approveAction} className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-5">
      {hidden}<input type="hidden" name="decision" value="APPROVE" />
      <h2 className="font-bold text-neutral-900">Approve to Main Contacts</h2>
      <p className="text-sm text-neutral-600">The server checks potential duplicates before approving. Approval never grants consent, creates a Lead or sends a message.</p>
      <label htmlFor={`queue-approve-${contactId}`} className="block text-sm font-semibold">Why approve? (required)
        <textarea id={`queue-approve-${contactId}`} name="reason" required minLength={10} maxLength={300} rows={3}
          className="mt-2 w-full rounded-xl border border-neutral-300 p-3 text-sm" placeholder="Explain the source and independent review." />
      </label>
      <button disabled={approving || rejecting} type="submit" className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {approving ? "Reviewing…" : "Approve into Main"}
      </button>
      {approveResult && <p role={approveResult.status === "error" ? "alert" : "status"} className="text-sm">{approveResult.message}</p>}
    </form>
    <form action={rejectAction} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
      {hidden}<input type="hidden" name="decision" value="REJECT" />
      <h2 className="font-bold text-neutral-900">Reject and archive</h2>
      <p className="text-sm text-neutral-600">Keep the original imported row and audit history. Rejected records cannot be restored by the ordinary archive action.</p>
      <label htmlFor={`queue-reject-${contactId}`} className="block text-sm font-semibold">Why reject? (required)
        <textarea id={`queue-reject-${contactId}`} name="reason" required minLength={10} maxLength={300} rows={3}
          className="mt-2 w-full rounded-xl border border-neutral-300 p-3 text-sm" placeholder="Explain why this record should not enter Main Contacts." />
      </label>
      <button disabled={approving || rejecting} type="submit" className="rounded-full border border-neutral-400 bg-white px-5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50">
        {rejecting ? "Reviewing…" : "Reject and archive"}
      </button>
      {rejectResult && <p role={rejectResult.status === "error" ? "alert" : "status"} className="text-sm">{rejectResult.message}</p>}
    </form>
  </section>;
}

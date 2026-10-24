"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { respondToContactTransfer, type TransferDecisionState } from "@/app/admin/(protected)/my-contacts/transfers/actions";

export function ContactTransferDecisionForm({ transferId }: { transferId: string }) {
  const router = useRouter();
  const [approve, approveAction, approving] = useActionState<TransferDecisionState | null, FormData>(respondToContactTransfer, null);
  const [reject, rejectAction, rejecting] = useActionState<TransferDecisionState | null, FormData>(respondToContactTransfer, null);
  useEffect(() => {
    if (approve?.status === "success" || reject?.status === "success") router.refresh();
  }, [approve, reject, router]);
  return <div className="flex flex-wrap items-start gap-2">
    <form action={approveAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="transferId" value={transferId}/><input type="hidden" name="decision" value="APPROVE"/>
      <input type="hidden" name="reason" value="Recipient accepted transfer after review."/>
      <button type="submit" disabled={approving || rejecting} className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{approving ? "Accepting…" : "Approve transfer"}</button>
    </form>
    <form action={rejectAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="transferId" value={transferId}/><input type="hidden" name="decision" value="REJECT"/>
      <label className="sr-only" htmlFor={`transfer-reason-${transferId}`}>Rejection reason</label>
      <input id={`transfer-reason-${transferId}`} name="reason" required minLength={10} maxLength={300} placeholder="Reason for rejection" className="w-48 rounded-xl border border-neutral-300 px-3 py-2 text-xs"/>
      <button type="submit" disabled={approving || rejecting} className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-800 disabled:opacity-50">{rejecting ? "Rejecting…" : "Reject"}</button>
    </form>
    {(approve || reject) && <p role="status" className="basis-full text-xs text-neutral-700">{approve?.message || reject?.message}</p>}
  </div>;
}

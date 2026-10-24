"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelPendingContactTransfer,
  type TransferDecisionState,
} from "@/app/admin/(protected)/my-contacts/transfers/actions";

export function ContactTransferAdminResolutionForm({
  transferId,
  recipientUnavailable,
}: {
  transferId: string;
  recipientUnavailable: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<TransferDecisionState | null, FormData>(
    cancelPendingContactTransfer,
    null,
  );

  useEffect(() => {
    if (state?.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="min-w-56 space-y-2">
      <input type="hidden" name="transferId" value={transferId} />
      <label className="block text-xs font-semibold text-neutral-700">
        <span className="sr-only">Administrator resolution reason</span>
        <input
          name="reason"
          required
          minLength={10}
          maxLength={300}
          placeholder={recipientUnavailable ? "Reason: recipient unavailable" : "Reason for cancellation"}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-800 disabled:opacity-50"
      >
        {pending ? "Resolving…" : "Cancel / resolve transfer"}
      </button>
      {state ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs ${state.status === "error" ? "text-red-800" : "text-emerald-800"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

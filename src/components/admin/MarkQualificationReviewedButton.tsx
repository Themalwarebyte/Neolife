"use client";

import { useActionState } from "react";
import {
  markQualificationReviewed,
  type CrmActionResult,
} from "@/app/admin/(protected)/actions";

export function MarkQualificationReviewedButton({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    markQualificationReviewed,
    null,
  );

  if (state?.status === "success") {
    return <p role="status" className="text-sm font-semibold text-emerald-700">Reviewed</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={leadId} />
      {state?.status === "error" ? (
        <p role="alert" className="text-xs font-medium text-red-700">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-mulberry-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mulberry-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mulberry-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark reviewed"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { completeFollowUpsBulk, type CrmActionResult } from "@/app/admin/(protected)/actions";

/** Checkboxes in task rows associate with this form via the HTML form attribute. */
export function BulkCompleteFollowUpsForm() {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    completeFollowUpsBulk, null,
  );
  return <form id="phase28-bulk-follow-ups" action={action} className="flex flex-wrap items-center gap-3">
    <button type="submit" disabled={pending}
      className="rounded-xl border border-mulberry-300 bg-white px-3 py-2 text-sm font-semibold text-mulberry-800 hover:bg-mulberry-50 disabled:opacity-60">
      {pending ? "Completing…" : "Complete selected"}
    </button>
    {state?.message && <p role="status" className={`text-sm ${state.status === "success" ? "text-brand-700" : "text-red-600"}`}>{state.message}</p>}
  </form>;
}

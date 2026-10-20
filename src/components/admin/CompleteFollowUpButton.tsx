"use client";

import { useActionState } from "react";
import { completeFollowUp, type CrmActionResult } from "@/app/admin/(protected)/actions";

export function CompleteFollowUpButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    completeFollowUp,
    null,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="followUpId" value={id} />
      <button type="submit" disabled={pending || state?.status === "success"}
        className="rounded-full border border-mulberry-200 bg-white px-3 py-1.5 text-xs font-semibold text-mulberry-800 hover:bg-mulberry-50 disabled:opacity-50">
        {pending ? "Updating…" : state?.status === "success" ? "Completed" : "Mark complete"}
      </button>
      {state?.message ? <span role="status" className={`text-xs ${state.status === "success" ? "text-mulberry-700" : "text-red-600"}`}>{state.message}</span> : null}
    </form>
  );
}

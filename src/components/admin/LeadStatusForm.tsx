"use client";

import { useActionState } from "react";
import {
  updateLeadStatus,
  type CrmActionResult,
} from "@/app/admin/(protected)/actions";
import { VALID_LEAD_STATUSES } from "@/lib/leadManagement";

export function LeadStatusForm({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    updateLeadStatus,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="id" value={leadId} />
      <div className="grow">
        <label htmlFor="status" className="text-sm font-semibold text-neutral-800">
          Lifecycle status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={currentStatus}
          className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {VALID_LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update status"}
      </button>
      {state?.message ? (
        <p
          role="status"
          className={`text-sm ${state.status === "success" ? "text-brand-700" : "text-red-600"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

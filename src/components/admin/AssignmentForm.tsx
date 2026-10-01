"use client";

import { useActionState } from "react";
import { assignLead, type CrmActionResult } from "@/app/admin/(protected)/actions";

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * Phase B — Owner-only lead assignment control.
 * Shows on the lead detail page for the Owner only.
 * Staff users never see this component.
 */
export function AssignmentForm({
  leadId,
  currentAssignee,
  staffUsers,
}: {
  leadId: string;
  currentAssignee: StaffUser | null;
  staffUsers: StaffUser[];
}) {
  const [state, action, pending] = useActionState<CrmActionResult | null, FormData>(
    assignLead,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />

      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-800">
            Assigned to
          </span>
          {currentAssignee ? (
            <>
              <span className="text-sm text-neutral-700">{currentAssignee.name}</span>
              <span className="text-xs text-neutral-400">({currentAssignee.email})</span>
            </>
          ) : (
            <span className="text-sm text-neutral-400">Unassigned</span>
          )}
        </div>

        <label
          htmlFor={`assignee-${leadId}`}
          className="mt-2 block text-sm font-semibold text-neutral-800"
        >
          Reassign
        </label>
        <select
          id={`assignee-${leadId}`}
          name="assignedUserId"
          defaultValue={currentAssignee?.id ?? ""}
          className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">— Unassigned (leave in Owner pool) —</option>
          {staffUsers.map((staff) => (
            <option key={staff.id} value={staff.id}>
              {staff.name} ({staff.email})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save assignment"}
        </button>
      </div>

      {state?.message ? (
        <p
          role="status"
          className={`text-sm ${
            state.status === "success" ? "text-brand-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

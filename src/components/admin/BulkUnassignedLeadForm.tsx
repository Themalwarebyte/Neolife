"use client";

import { useActionState } from "react";
import { assignUnassignedLeadsBulk, type CrmActionResult } from "@/app/admin/(protected)/actions";

export function BulkUnassignedLeadForm({ staff }: { staff: { id: string; name: string }[] }) {
  const [result, action, pending] = useActionState<CrmActionResult | null, FormData>(
    assignUnassignedLeadsBulk, null,
  );
  return <form id="phase28-bulk-assign" action={action} className="flex flex-wrap items-end gap-3">
    <div className="min-w-56 flex-1">
      <label htmlFor="phase28-assignee" className="text-sm font-semibold text-neutral-800">Assign selected contacts to</label>
      <select id="phase28-assignee" name="targetUserId" required defaultValue=""
        className="mt-1 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm">
        <option value="" disabled>Select active Staff member</option>
        {staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
    </div>
    <button type="submit" disabled={pending || !staff.length}
      className="rounded-xl bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-mulberry-800 disabled:opacity-60">
      {pending ? "Assigning…" : "Assign selected"}
    </button>
    {result?.message && <p role="status" className={`w-full text-sm ${result.status === "success" ? "text-brand-700" : "text-red-600"}`}>{result.message}</p>}
    <p className="w-full text-xs text-neutral-500">Only currently unassigned contacts can be assigned here. The action records an audit event for each contact.</p>
  </form>;
}

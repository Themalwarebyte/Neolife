"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { bulkManageContacts, type BulkContactState } from "@/app/admin/(protected)/my-contacts/bulk-actions";

type Recipient = { id: string; name: string; email: string; phone: string | null };

export function ContactBulkForm({ children, view, role, scopeAll, users }: {
  children: ReactNode; view: string; role: string; scopeAll: boolean; users: Recipient[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<BulkContactState | null, FormData>(bulkManageContacts, null);
  useEffect(() => { if (state?.status === "success") router.refresh(); }, [state, router]);
  const admin = role === "admin";
  const canPool = admin && ["main", "archived"].includes(view);
  const canSend = admin && ["main", "queue", "pool"].includes(view);
  const canArchive = ["main"].includes(view);
  const canRestore = ["archived"].includes(view);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="view" value={view}/>
    {scopeAll ? <input type="hidden" name="scope" value="all"/> : null}
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-bold text-neutral-900">Bulk contact actions</p>
        <p className="mt-1 text-xs text-neutral-600">Select contacts below. Up to 100 unique contacts per operation; each record is independently authorized and audited.</p>
      </div>
      {canSend ? <label className="text-xs font-semibold text-neutral-700">Send to user (recipient must approve)
        <select name="recipientUserId" defaultValue="" className="mt-1 block min-w-48 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">Choose recipient…</option>
          {users.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
        </select>
      </label> : null}
      <div className="flex flex-wrap gap-2">
        {canArchive ? <button name="bulkAction" value="ARCHIVE" disabled={pending} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 disabled:opacity-50">Archive selected</button> : null}
        {canRestore ? <button name="bulkAction" value="RESTORE" disabled={pending} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 disabled:opacity-50">Restore selected</button> : null}
        {canPool ? <button name="bulkAction" value="MOVE_TO_POOL" disabled={pending} className="rounded-full border border-mulberry-300 bg-white px-4 py-2 text-xs font-semibold text-mulberry-800 disabled:opacity-50">Move to Contact Pool</button> : null}
        {canSend ? <button name="bulkAction" value="SEND_TO_USER" disabled={pending} className="rounded-full bg-mulberry-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Send selected to user</button> : null}
      </div>
    </div>
    {children}
    {state ? <p role={state.status === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>{state.message}</p> : null}
    {state?.whatsappUrl ? <a href={state.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white">Open WhatsApp message</a> : null}
  </form>;
}

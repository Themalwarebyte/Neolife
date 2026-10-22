"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  archiveManualContact,
  restoreManualContact,
  type ContactActionResult,
} from "@/app/admin/(protected)/my-contacts/actions";

export function ContactStateForm({ id, version, archived }: { id: string; version: number; archived: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ContactActionResult | null, FormData>(
    archived ? restoreManualContact : archiveManualContact, null,
  );
  useEffect(() => {
    if (state?.status === "success") router.refresh();
  }, [router, state]);
  return <form action={action} className="flex flex-wrap items-center gap-3">
    <input type="hidden" name="contactId" value={id} />
    <input type="hidden" name="expectedVersion" value={version} />
    <button type="submit" disabled={pending}
      className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60">
      {pending ? "Saving…" : archived ? "Restore to Main Contacts" : "Archive contact"}
    </button>
    {state?.message && <p role={state.status === "error" ? "alert" : "status"} className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p>}
  </form>;
}

"use client";

import { useActionState } from "react";
import { scanDuplicateIssues, type DuplicateActionResult } from "@/app/admin/(protected)/my-contacts/duplicates/actions";

export function ContactDuplicateScanForm({ scopeAll }: { scopeAll: boolean }) {
  const [result, action, pending] = useActionState<DuplicateActionResult | null, FormData>(scanDuplicateIssues, null);
  return <form action={action} className="flex flex-wrap items-center gap-3">
    <input type="hidden" name="scope" value={scopeAll ? "all" : "mine"} />
    <button type="submit" disabled={pending}
      className="rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-mulberry-800 disabled:opacity-50">
      {pending ? "Scanning…" : scopeAll ? "Scan team records" : "Scan my contacts"}
    </button>
    {result ? <span role={result.status === "error" ? "alert" : "status"}
      className={`max-w-2xl text-sm ${result.status === "error" ? "text-red-700" : "text-emerald-800"}`}>{result.message}</span> : null}
  </form>;
}

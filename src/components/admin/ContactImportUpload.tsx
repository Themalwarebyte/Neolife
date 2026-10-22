"use client";

import Link from "next/link";
import { useActionState } from "react";
import { previewContactSheet, type PreviewState } from "@/app/admin/(protected)/my-contacts/import/actions";
import { ContactImportMapping } from "@/components/admin/ContactImportMapping";

export function ContactImportUpload() {
  const [state, uploadAction, pending] = useActionState<PreviewState | null, FormData>(previewContactSheet, null);
  return <div className="space-y-6">
    <form action={uploadAction} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-neutral-900">Upload contacts for review</h2>
      <p className="text-sm leading-6 text-neutral-600">Upload a CSV or XLSX with a header row and up to 500 contacts. Maximum file size: 768 KB. Uploading only creates a private preview. Confirm the column mapping before anything enters the Imported Queue.</p>
      <label htmlFor="contact-sheet" className="block text-sm font-semibold text-neutral-800">CSV or XLSX file
        <input id="contact-sheet" type="file" name="sheet" required accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="mt-2 block w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm" />
      </label>
      <button disabled={pending} type="submit" className="rounded-full bg-mulberry-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Reading spreadsheet…" : "Review spreadsheet"}
      </button>
      {state ? <p role="status" className={`rounded-xl p-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-800" : "bg-mulberry-50 text-mulberry-900"}`}>
        {state.message} {state.status === "existing" && state.batchId ? <Link className="font-semibold underline" href={`/admin/my-contacts/import/${state.batchId}`}>View import</Link> : null}
      </p> : null}
    </form>
    {state?.status === "preview" && state.batchId && state.headers && state.mapping && state.sample ?
      <ContactImportMapping batchId={state.batchId} headers={state.headers} mapping={state.mapping}
        sample={state.sample} total={state.total || 0} /> : null}
  </div>;
}

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { confirmContactSheet, type ConfirmState } from "@/app/admin/(protected)/my-contacts/import/actions";
import { IMPORT_FIELDS, type ImportMapping } from "@/lib/contact-import-fields";

const labels: Record<keyof ImportMapping, string> = {
  fullName: "Full name", firstName: "First name", lastName: "Last name", city: "City / town",
  phone1: "Primary phone", phone2: "Phone 2", phone3: "Phone 3",
  email1: "Primary email", email2: "Email 2", email3: "Email 3",
  sourceDetail: "Contact source", notes: "Notes", consentStatus: "Consent status",
  consentEvidence: "Consent evidence", doNotContact: "Do Not Contact",
};

export function ContactImportMapping({ batchId, headers, mapping, sample, total }: {
  batchId: string; headers: string[]; mapping: ImportMapping; sample: string[][]; total: number;
}) {
  const [state, confirmAction, pending] = useActionState<ConfirmState | null, FormData>(confirmContactSheet, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.status === "success" && state.batchId) router.push(`/admin/my-contacts/import/${state.batchId}`);
  }, [state, router]);
  return <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
    <div><h2 className="text-lg font-bold text-neutral-900">Confirm field mapping</h2>
      <p className="mt-1 text-sm leading-6 text-neutral-600">{total} nonempty rows found. Map either first name or full name and at least one phone/email column. Each source column can only be assigned once. No messages will be sent.</p></div>
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full min-w-[640px] text-left text-xs"><thead className="bg-neutral-50"><tr>{headers.map((h, i) =>
        <th key={i} className="min-w-[130px] px-3 py-2">{h || `Column ${i + 1}`}</th>)}</tr></thead>
        <tbody className="divide-y divide-neutral-100">{sample.map((row, i) => <tr key={i}>{headers.map((_, j) =>
          <td key={j} className="max-w-[180px] break-words px-3 py-2 align-top">{(row[j] || "").slice(0, 180)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <form action={confirmAction} className="space-y-5">
      <input type="hidden" name="batchId" value={batchId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_FIELDS.map(field => <label key={field} className="text-xs font-semibold text-neutral-800">
          {labels[field]}
          <select key={`${batchId}-${field}`} name={`map_${field}`} defaultValue={mapping[field] ?? ""}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900">
            <option value="">Do not import</option>
            {headers.map((header, i) => <option key={i} value={i}>{header || `Column ${i + 1}`} (#{i + 1})</option>)}
          </select>
        </label>)}
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Imported records start in the unreviewed Imported Queue, never in Main Contacts or the sales Lead pipeline. Imported consent defaults to Unknown unless your mapped data explicitly records another status. Do Not Contact is always enforced.</p>
      <button disabled={pending} type="submit" className="rounded-full bg-mulberry-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Importing…" : `Confirm and import ${total} rows`}
      </button>
      {state ? <p role="status" className={`rounded-xl p-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-900"}`}>{state.message}</p> : null}
    </form>
  </section>;
}

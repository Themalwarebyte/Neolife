"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { correctRejectedImport, type CorrectRejectedImportState } from "@/app/admin/(protected)/my-contacts/rejected-imports/actions";

export function RejectedImportCorrectionForm({ rowId, headers, values, correctionCount }: {
  rowId: string; headers: string[]; values: string[]; correctionCount: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CorrectRejectedImportState | null, FormData>(correctRejectedImport, null);
  useEffect(() => {
    if (state?.status === "success") router.push("/admin/my-contacts?view=queue");
    else if (state) router.refresh();
  }, [state, router]);
  return <form action={action} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5">
    <input type="hidden" name="rowId" value={rowId}/>
    <div><h2 className="text-lg font-bold text-neutral-900">Correct rejected import row</h2>
      <p className="mt-1 text-sm text-neutral-600">Edit the original row cells below. The original spreadsheet values remain preserved in import history. The corrected row will be revalidated before it can enter Imported Queue. Previous correction attempts: {correctionCount}.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      {headers.map((header, index) => <label key={index} className="text-xs font-semibold text-neutral-800">
        {header || `Column ${index + 1}`}
        <input name={`value_${index}`} defaultValue={values[index] || ""} maxLength={4000}
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-normal text-neutral-900"/>
      </label>)}
    </div>
    <button type="submit" disabled={pending} className="rounded-full bg-mulberry-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Revalidating…" : "Save corrections and revalidate"}</button>
    {state ? <p role={state.status === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>{state.message}</p> : null}
  </form>;
}

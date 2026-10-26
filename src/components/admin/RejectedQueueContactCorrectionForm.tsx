"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { requeueRejectedContact, type CorrectRejectedImportState } from "@/app/admin/(protected)/my-contacts/rejected-imports/actions";

type Method = { type: "PHONE" | "EMAIL"; value: string };
export function RejectedQueueContactCorrectionForm({ contact }: {
  contact: { id: string; version: number; firstName: string; lastName: string | null; city: string | null;
    sourceDetail: string | null; notes: string | null; consentStatus: "UNKNOWN" | "GRANTED" | "DENIED";
    consentEvidence: string | null; doNotContact: boolean; methods: Method[] };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CorrectRejectedImportState | null, FormData>(requeueRejectedContact, null);
  useEffect(() => { if (state?.status === "success") router.replace("/admin/my-contacts?view=queue"); }, [state, router]);
  const phones = contact.methods.filter(method => method.type === "PHONE").map(method => method.value);
  const emails = contact.methods.filter(method => method.type === "EMAIL").map(method => method.value);
  while (phones.length < 3) phones.push("");
  while (emails.length < 3) emails.push("");
  return <form action={action} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5">
    <input type="hidden" name="contactId" value={contact.id}/><input type="hidden" name="expectedVersion" value={contact.version}/>
    <div><h2 className="text-lg font-bold text-neutral-900">Correct rejected contact and return it to Imported Queue</h2>
      <p className="mt-1 text-sm text-neutral-600">Correct the details that led to the previous rejection. Saving this form does not approve the contact; it resets the previous queue decision and returns the record for a fresh review. The old rejection remains in audit history.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">First name<input name="firstName" required maxLength={80} defaultValue={contact.firstName} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label>
      <label className="text-sm font-semibold">Last name<input name="lastName" maxLength={80} defaultValue={contact.lastName || ""} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label>
      <label className="text-sm font-semibold">City<input name="city" maxLength={100} defaultValue={contact.city || ""} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label>
      <label className="text-sm font-semibold">Source / source detail<input name="sourceDetail" maxLength={160} defaultValue={contact.sourceDetail || ""} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <fieldset className="space-y-2"><legend className="text-sm font-bold">Phone numbers (up to 3)</legend>{phones.map((value, index) => <label key={index} className="block text-xs text-neutral-600">Phone {index + 1}<input name="phones" type="tel" maxLength={40} defaultValue={value} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900"/></label>)}</fieldset>
      <fieldset className="space-y-2"><legend className="text-sm font-bold">Email addresses (up to 3)</legend>{emails.map((value, index) => <label key={index} className="block text-xs text-neutral-600">Email {index + 1}<input name="emails" type="email" maxLength={254} defaultValue={value} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900"/></label>)}</fieldset>
    </div>
    <label className="block text-sm font-semibold">Notes<textarea name="notes" maxLength={4000} rows={4} defaultValue={contact.notes || ""} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Consent status<select name="consentStatus" defaultValue={contact.consentStatus} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 font-normal"><option value="UNKNOWN">Unknown</option><option value="GRANTED">Granted</option><option value="DENIED">Denied</option></select></label>
      <label className="text-sm font-semibold">Consent evidence<input name="consentEvidence" maxLength={200} defaultValue={contact.consentEvidence || ""} placeholder="How and when permission was recorded" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label>
    </div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="doNotContact" defaultChecked={contact.doNotContact} className="mt-1 h-4 w-4"/><span><strong>Do Not Contact</strong><span className="block text-xs text-neutral-600">Keep enabled if this person must not be called or emailed.</span></span></label>
    {contact.doNotContact ? <label className="block text-sm font-semibold">Reason if lifting Do Not Contact restriction<textarea name="dncLiftReason" maxLength={300} rows={2} placeholder="Required only if you uncheck Do Not Contact" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label> : null}
    <button disabled={pending} className="rounded-full bg-mulberry-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving corrections…" : "Save corrections and return to Imported Queue"}</button>
    {state ? <p role={state.status === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>{state.message}</p> : null}
  </form>;
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createManualContact,
  updateManualContact,
  type ContactActionResult,
} from "@/app/admin/(protected)/my-contacts/actions";
import type { ContactConsent } from "@/lib/contact-intake";

type InitialContact = {
  id: string;
  version: number;
  firstName: string;
  lastName: string | null;
  city: string | null;
  sourceDetail: string | null;
  notes: string | null;
  consentStatus: ContactConsent;
  consentEvidence: string | null;
  doNotContact: boolean;
  methods: { type: "PHONE" | "EMAIL"; value: string }[];
};

const fieldClass = "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-mulberry-600 focus:outline-none focus:ring-2 focus:ring-mulberry-200";

function MethodInputs({
  idPrefix, label, fieldName, values, onChange,
}: {
  idPrefix: string;
  label: string;
  fieldName: "phones" | "emails";
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return <fieldset className="space-y-2">
    <legend className="text-sm font-semibold text-neutral-800">{label}</legend>
    {values.map((value, index) => <div key={`${idPrefix}-${index}`} className="flex items-start gap-2">
      <label className="min-w-0 flex-1 text-xs text-neutral-600" htmlFor={`${idPrefix}-${index}`}>
        {index === 0 ? "Primary" : `Additional ${index}`}
        <input
          className={fieldClass}
          id={`${idPrefix}-${index}`}
          name={fieldName}
          type={fieldName === "emails" ? "email" : "tel"}
          autoComplete="off"
          maxLength={fieldName === "emails" ? 254 : 40}
          placeholder={fieldName === "emails" ? "person@example.com" : "+254712345678 or 0712345678"}
          value={value}
          onChange={event => onChange(values.map((item, i) => i === index ? event.target.value : item))}
        />
      </label>
      {values.length > 1 ? <button
        type="button"
        className="mt-6 rounded-lg border border-neutral-200 px-2 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
        onClick={() => onChange(values.filter((_, i) => i !== index))}
        aria-label={`Remove ${fieldName} field ${index + 1}`}
      >Remove</button> : null}
    </div>)}
    {values.length < 3 ? <button
      type="button"
      onClick={() => onChange([...values, ""])}
      className="text-xs font-semibold text-mulberry-800 hover:underline"
    >+ Add another {fieldName === "emails" ? "email" : "phone"}</button> : null}
  </fieldset>;
}

/** Manual intake never creates Lead, sends messages or assumes consent. */
export function ManualContactForm({ contact }: { contact?: InitialContact }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ContactActionResult | null, FormData>(
    contact ? updateManualContact : createManualContact, null,
  );
  const [consentStatus, setConsentStatus] = useState<ContactConsent>(contact?.consentStatus || "UNKNOWN");
  const [phones, setPhones] = useState<string[]>(
    contact?.methods.filter(m => m.type === "PHONE").map(m => m.value).slice(0, 3) || [""],
  );
  const [emails, setEmails] = useState<string[]>(
    contact?.methods.filter(m => m.type === "EMAIL").map(m => m.value).slice(0, 3) || [""],
  );
  const contactId = contact?.id;
  useEffect(() => {
    if (state?.status === "success") {
      if (!contactId && state.contactId) router.push(`/admin/my-contacts/${state.contactId}`);
      else router.refresh();
    }
  }, [state, contactId, router]);

  const phoneValues = phones.length ? phones : [""];
  const emailValues = emails.length ? emails : [""];

  return <form action={formAction} className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
    {contact ? <>
      <input type="hidden" name="contactId" value={contact.id} />
      <input type="hidden" name="expectedVersion" value={contact.version} />
    </> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-neutral-800" htmlFor="contact-firstName">
        First name <span className="text-red-600">*</span>
        <input id="contact-firstName" name="firstName" required maxLength={80} defaultValue={contact?.firstName || ""} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-neutral-800" htmlFor="contact-lastName">
        Last name
        <input id="contact-lastName" name="lastName" maxLength={80} defaultValue={contact?.lastName || ""} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-neutral-800" htmlFor="contact-city">
        City or area
        <input id="contact-city" name="city" maxLength={100} defaultValue={contact?.city || ""} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-neutral-800" htmlFor="contact-source">
        How you know this person (optional)
        <input id="contact-source" name="sourceDetail" maxLength={160} defaultValue={contact?.sourceDetail || ""} className={fieldClass} placeholder="E.g. referral, meeting, personal connection" />
      </label>
    </div>
    <div className="rounded-xl bg-mulberry-50/50 p-4">
      <p className="mb-3 text-sm text-neutral-700">Enter at least one phone number or email address. Kenya national phone formats and international <strong>+country</strong> numbers are supported.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <MethodInputs idPrefix="contact-phone" label="Phone numbers" fieldName="phones" values={phoneValues} onChange={setPhones} />
        <MethodInputs idPrefix="contact-email" label="Email addresses" fieldName="emails" values={emailValues} onChange={setEmails} />
      </div>
      <p className="mt-3 text-xs text-neutral-600">Matching contact details are not automatically merged. Duplicate review is introduced in Batch C.</p>
    </div>
    <label htmlFor="contact-notes" className="block text-sm font-semibold text-neutral-800">
      Private notes
      <textarea id="contact-notes" name="notes" rows={4} maxLength={4000} defaultValue={contact?.notes || ""} className={fieldClass} placeholder="Context or details to remember; avoid unnecessary sensitive information." />
    </label>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <label htmlFor="contact-consent" className="block text-sm font-semibold text-neutral-900">
        Permission to contact
        <select id="contact-consent" name="consentStatus" value={consentStatus} onChange={event => setConsentStatus(event.target.value as ContactConsent)} className={fieldClass}>
          <option value="UNKNOWN">Not established</option>
          <option value="GRANTED">Permission granted (confirmed by you)</option>
          <option value="DENIED">Permission denied</option>
        </select>
      </label>
      <label className="mt-4 block text-sm font-semibold text-neutral-900" htmlFor="contact-evidence">
        Permission provenance {consentStatus === "GRANTED" ? <span className="text-red-700">*</span> : "(optional)"}
        <input id="contact-evidence" name="consentEvidence" maxLength={200} minLength={consentStatus === "GRANTED" ? 10 : undefined}
          required={consentStatus === "GRANTED"} defaultValue={contact?.consentEvidence || ""} className={fieldClass}
          placeholder="How and when the person granted or denied permission" />
      </label>
      <label className="mt-4 flex items-start gap-3 text-sm text-neutral-900" htmlFor="contact-dnc">
        <input id="contact-dnc" name="doNotContact" type="checkbox" defaultChecked={contact?.doNotContact || false} className="mt-1 h-4 w-4 accent-mulberry-700" />
        <span><strong>Do Not Contact.</strong> This restriction overrides any permission selection. No messages are sent by this feature.</span>
      </label>
      {contact?.doNotContact ? <label htmlFor="contact-lift-reason" className="mt-3 block text-xs font-semibold text-neutral-800">
        Reason for lifting this Do Not Contact restriction (required if you uncheck it)
        <textarea id="contact-lift-reason" name="dncLiftReason" rows={2} maxLength={300} className={fieldClass} placeholder="Explain documented permission or a correction" />
      </label> : null}
      <p className="mt-3 text-xs text-neutral-700">Saving a contact does not establish marketing consent or create an automatic follow-up.</p>
    </div>
    {state?.message ? <p role={state.status === "error" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm font-semibold ${state.status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{state.message}</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className="rounded-full bg-mulberry-700 px-6 py-3 text-sm font-semibold text-white hover:bg-mulberry-800 disabled:opacity-60">
        {pending ? "Saving…" : contact ? "Save contact changes" : "Add to Main Contacts"}
      </button>
      <span className="text-xs text-neutral-500">Manual personal contact, separate from the CRM lead pipeline.</span>
    </div>
  </form>;
}

"use client";

import { useActionState, useState } from "react";
import { sendClientEmail, type CrmActionResult } from "@/app/admin/(protected)/actions";

type Props = {
  leadId: string;
  leadName: string;
  phoneRaw: string | null;
  emailOnRecord: string | null;
  whatasppEnabled: boolean;
  emailEnabled: boolean;
  whatsappHref: string | null;
  telHref: string | null;
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

/**
 * Communications panel (D-034 Phase 4).
 * - Email composer: recipient is always the lead's address on record —
 *   displayed read-only, never editable (no recipient substitution).
 * - WhatsApp / call buttons open the OS-level handler; the panel states
 *   plainly that a sent message is NOT implied by opening them.
 */
export function CommunicationPanel({
  leadId,
  leadName,
  emailOnRecord,
  emailEnabled,
  whatsappHref,
  telHref,
}: Props) {
  const [state, formAction, pending] = useActionState<
    CrmActionResult | null,
    FormData
  >(sendClientEmail, null);
  const [body, setBody] = useState("");

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
        Communications
      </h2>

      {/* Quick actions */}
      <div className="mt-4 flex flex-wrap gap-3">
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.8-5c-.4-.7-.7-1.5-.7-2.2 0-.8.4-1.5.8-1.9.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.4l.9 2.1c.1.2 0 .4-.1.5l-.5.6c-.2.2-.3.3-.1.6.6 1 1.6 2 2.8 2.6.3.2.5.1.7-.1l.7-.8c.2-.2.4-.2.6-.1l2 1c.3.1.4.3.4.5s0 .7-.2 1Z" />
            </svg>
            WhatsApp
          </a>
        ) : null}
        {telHref ? (
          <a
            href={telHref}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2Z" />
            </svg>
            Call
          </a>
        ) : null}
      </div>
      {whatsappHref || telHref ? (
        <p className="mt-2 text-xs text-neutral-400">
          These buttons open WhatsApp or your phone dialer with the contact
          details prefilled. Opening them does not confirm that a message was
          sent — record real conversations in follow-up notes.
        </p>
      ) : null}

      {/* Email composer */}
      <form action={formAction} className="mt-6 border-t border-neutral-100 pt-5">
        <input type="hidden" name="leadId" value={leadId} />
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Email to {emailOnRecord ?? "— no email on record —"}
        </p>
        {!emailEnabled ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Sending is disabled: the email provider is not configured yet. You
            can still draft the message below — nothing will be sent.
          </p>
        ) : null}
        <div className="mt-3">
          <label htmlFor="subject" className="block text-sm font-semibold text-neutral-800">
            Subject
          </label>
          <input
            id="subject"
            name="subject"
            required
            maxLength={200}
            disabled={!emailEnabled || !emailOnRecord}
            placeholder={`Hello ${leadName}…`}
            className={fieldClass}
          />
        </div>
        <div className="mt-3">
          <label htmlFor="body" className="block text-sm font-semibold text-neutral-800">
            Message
          </label>
          <textarea
            id="body"
            name="body"
            required
            rows={6}
            maxLength={10000}
            disabled={!emailEnabled || !emailOnRecord}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`${fieldClass} resize-y`}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !emailEnabled || !emailOnRecord}
            className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send email"}
          </button>
          {state?.status === "success" ? (
            <p className="text-sm font-medium text-emerald-700" role="status">
              {state.message}
            </p>
          ) : null}
          {state?.status === "error" ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

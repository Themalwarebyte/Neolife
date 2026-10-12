"use client";

import { useActionState } from "react";
import type { CrmActionResult } from "@/app/admin/(protected)/actions";

type Member = { id: string; name: string; email: string; isActive: boolean };

type ReferralInfo = {
  code: string;
  isActive: boolean;
  revokedAt: Date | null;
  publicName: string;
  createdAt: Date;
} | null;

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export function ReferralLinkRow({
  member,
  referral,
  origin,
  generateReferral,
  revokeReferral,
}: {
  member: Member;
  referral: ReferralInfo;
  origin: string;
  generateReferral: (
    prev: CrmActionResult | null,
    formData: FormData,
  ) => Promise<CrmActionResult>;
  revokeReferral: (
    prev: CrmActionResult | null,
    formData: FormData,
  ) => Promise<CrmActionResult>;
}) {
  const [genState, genAction, genPending] = useActionState<
    CrmActionResult | null,
    FormData
  >(generateReferral, null);
  const [revState, revAction, revPending] = useActionState<
    CrmActionResult | null,
    FormData
  >(revokeReferral, null);

  const active = Boolean(referral?.isActive && !referral?.revokedAt);
  const link = active && referral ? `${origin}/business?ref=${referral.code}` : null;

  function copyLink() {
    if (link && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(link);
    }
  }

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-neutral-900">
            {member.name}
            {!member.isActive ? (
              <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                deactivated
              </span>
            ) : null}
          </p>
          <p className="text-xs text-neutral-400">{member.email}</p>
        </div>
        {active ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            Active link
          </span>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-500">
            No active link
          </span>
        )}
      </div>

      {active && referral ? (
        <div className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Public name (manual fallback)
          </p>
          <p className="text-sm text-neutral-700">{referral.publicName}</p>
          <p className="mt-2 break-all rounded-lg bg-white p-2 font-mono text-xs text-neutral-600">
            {link}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              Copy link
            </button>
            <form action={revAction}>
              <input type="hidden" name="staffUserId" value={member.id} />
              <button
                type="submit"
                disabled={revPending}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                {revPending ? "Revoking…" : "Revoke link"}
              </button>
            </form>
          </div>
          {revState?.message ? (
            <p className="mt-2 text-xs text-neutral-500" role="status">
              {revState.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <form action={genAction} className="mt-4 border-t border-neutral-100 pt-4">
        <input type="hidden" name="staffUserId" value={member.id} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label
              htmlFor={`publicName-${member.id}`}
              className="block text-xs font-semibold text-neutral-500"
            >
              {active ? "Rotate link & public name" : "Public display name"}
            </label>
            <input
              id={`publicName-${member.id}`}
              name="publicName"
              defaultValue={referral?.publicName ?? member.name}
              maxLength={60}
              required
              className={fieldClass}
            />
          </div>
          <button
            type="submit"
            disabled={genPending}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {genPending ? "Saving…" : active ? "Rotate link" : "Generate link"}
          </button>
        </div>
        {genState?.message ? (
          <p className="mt-2 text-xs text-neutral-500" role="status">
            {genState.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

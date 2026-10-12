"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  GENERIC_ERROR_MESSAGE,
  findActiveLeadByPhone,
  parseAttributionPayload,
  parseLeadInput,
  persistLead,
  type SubmitLeadInput,
} from "@/lib/leads";
import { generateQualificationToken } from "@/lib/qualification";
import { recordFunnelEvent } from "@/lib/funnel";
import { clientKeyFromHeaders, isRateLimited } from "@/lib/rateLimit";
import {
  MAX_PUBLIC_NAME_LENGTH,
  resolveReferralByName,
  resolveReferralCode,
} from "@/lib/referrals";
import { type ReferralAttribution } from "@/lib/leads";

export type SubmitLeadResult =
  | { status: "success"; message: string; qualificationToken?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const SAFE_CODE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * D-034 referral resolution — server-side only.
 *
 * Precedence: a valid, active referral link code ALWAYS wins over any
 * conflicting manual "Who referred you?" input. Invalid, revoked, missing
 * or inactive referrals fail safely to null → lead stays unassigned in the
 * Owner's pool. Nothing here can throw: capture must never be broken by a
 * bad referral input.
 */
async function resolveReferralAttribution(
  formData: FormData,
): Promise<ReferralAttribution | null> {
  const rawCode = formData.get("referralCode");
  if (typeof rawCode === "string" && rawCode.length > 0) {
    // Strict charset before any DB lookup: URL junk is dropped, never parsed.
    const code = rawCode.trim();
    if (SAFE_CODE.test(code) && code.length <= 64) {
      const resolved = await resolveReferralCode(code);
      if (resolved) {
        return {
          userId: resolved.userId,
          code: resolved.code,
          method: "link",
        };
      }
    }
    // An unusable link code means NO referral — a manual name is not
    // promoted to compensate (fail-safe, no attribution guessing).
    return null;
  }

  const rawName = formData.get("referredByName");
  if (typeof rawName === "string" && rawName.trim().length > 0) {
    const typed = rawName.trim().slice(0, MAX_PUBLIC_NAME_LENGTH);
    const resolved = await resolveReferralByName(typed);
    if (resolved) {
      return {
        userId: resolved.userId,
        code: resolved.code,
        method: "manual_name",
        typedName: typed,
      };
    }
    return null;
  }

  return null;
}

/**
 * Server Action handling public lead submissions.
 * Next.js Server Actions include built-in same-origin checks (CSRF mitigation).
 */
export async function submitLeadAction(
  _previous: SubmitLeadResult | null,
  formData: FormData,
): Promise<SubmitLeadResult> {
  // Basic abuse control (honeypot + rate limit)
  const headerList = await headers();
  if (isRateLimited(clientKeyFromHeaders(headerList))) {
    return {
      status: "error",
      message: "Too many requests. Please wait a minute and try again.",
    };
  }

  const input: SubmitLeadInput = {
    firstName: formData.get("firstName") ?? undefined,
    lastName: formData.get("lastName") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    email: formData.get("email") ?? undefined,
    city: formData.get("city") ?? undefined,
    interestType: formData.get("interestType") ?? undefined,
    consent: formData.get("consent") === "on" ? true : undefined,
    website: formData.get("website") ?? undefined,
    // Task 1.4 — first-party attribution (hidden fields), re-validated:
    utmSource: formData.get("utmSource") ?? undefined,
    utmMedium: formData.get("utmMedium") ?? undefined,
    utmCampaign: formData.get("utmCampaign") ?? undefined,
    utmContent: formData.get("utmContent") ?? undefined,
    utmTerm: formData.get("utmTerm") ?? undefined,
    landingPage: formData.get("landingPage") ?? undefined,
  };

  const parsed = parseLeadInput(input);
  if (!parsed.ok) {
    if (parsed.message === "") {
      // Honeypot hit — respond neutrally.
      return { status: "success", message: "" };
    }
    return { status: "error", message: parsed.message, fieldErrors: parsed.fieldErrors };
  }

  // Phase D: extract deviceId for funnel correlation (non-PII UUID v4).
  const deviceId =
    typeof formData.get("deviceId") === "string" && formData.get("deviceId")
      ? String(formData.get("deviceId"))
      : null;

  try {
    const existing = await findActiveLeadByPhone(parsed.data.phone);
    if (existing) {
      return {
        status: "success",
        message:
          "We already have your details — our team will be in touch soon.",
      };
    }

    const attribution = parseAttributionPayload(input);
    const referral = await resolveReferralAttribution(formData);
    const persisted = await persistLead(parsed.data, attribution, referral);

    // Phase D: record the authoritative lead_created FunnelEvent (server-side only).
    await recordFunnelEvent({
      type: "lead_created",
      leadId: persisted.id,
      deviceId: deviceId ?? null,
      attribution: attribution ?? null,
    });

    // Phase D: generate a qualification continuation token for the post-capture
    // qualification step (D-030). This is returned to the client so the success
    // page can offer "Continue to Qualification".
    const qualificationToken = await generateQualificationToken(persisted.id);

    // Revalidate leads pages so the new lead appears.
    revalidatePath("/admin/leads");

    return {
      status: "success",
      message:
        "Thank you — your interest has been registered. The office team will contact you to answer your questions and, if you would like, arrange a meeting.",
      qualificationToken,
    };
  } catch {
    // Never expose database or internal errors to the public.
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }
}

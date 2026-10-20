import { z } from "zod";
import { validateCountryPhone } from "@/lib/phone-country";
import { prisma } from "@/server/db/prisma";
import { parseAttribution, type Attribution } from "@/lib/attribution";
import {
  NOTIFICATION_TYPES,
  tryNewNotification,
} from "@/lib/notifications";
import {
  activeAdminsForQueueAlert,
  notificationRecipientEmail,
  tryRecordAssignmentNotification,
  trySendLeadAlertEmail,
} from "@/lib/notificationsEmail";

/**
 * Task 1.5 — lead-capture validation & persistence (public, untrusted input).
 *
 * Security notes:
 * - All validation happens here, server-side. Client validation is UX only.
 * - Prisma parameterizes all queries (SQL-injection safe).
 * - React escapes all rendered output (XSS safe); we additionally trim/limit input.
 * - A honeypot field + in-memory rate limiter provide basic spam/abuse control.
 * - Server Actions include Next.js origin checks (CSRF mitigation).
 *
 * Attribution (utm_*, firstTouchSource, landingPage) is intentionally NOT
 * populated here — Task 1.4 will add attribution without changing this flow.
 */

export const INTEREST_TYPES = ["BUSINESS", "PRODUCT", "BOTH", "UNSURE"] as const;

export type SubmitLeadInput = {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  phoneCountry?: unknown;
  email?: unknown;
  city?: unknown;
  interestType?: unknown;
  consent?: unknown;
  website?: unknown; // honeypot — must be empty
  // Task 1.4 attribution (first-party, client-captured, re-validated here)
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  utmTerm?: unknown;
  landingPage?: unknown;
  firstTouchSource?: unknown;
};

/** Normalizes a phone number for storage/duplicate checks (digits and leading + only). */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return plus ? `+${digits}` : digits;
}

export const leadSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(80, "Name is too long."),
  lastName: z
    .string()
    .trim()
    .max(80, "Name is too long.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  phone: z
    .string()
    .trim()
    .max(32, "Phone number is too long.")
    .refine(
      (value) => /^\+?\d[\d\s\-()]{3,31}$/.test(value),
      "Please enter a valid phone number.",
    )
    .transform(normalizePhone),
  email: z
    .email("Please enter a valid email address.")
    .trim()
    .max(160, "Email is too long.")
    .optional()
    .transform((value) => (value ? value : undefined))
    .or(z.literal("").transform(() => undefined)),
  city: z
    .string()
    .trim()
    .max(80, "Area is too long.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  interestType: z.enum(INTEREST_TYPES, {
    message: "Please choose what you are interested in.",
  }),
  consent: z.literal(true, {
    message: "Please confirm you are happy for us to contact you.",
  }),
});

export type LeadParseResult =
  | { ok: true; data: z.output<typeof leadSchema> }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

// Task 1.4 — server-side validation of client-supplied attribution.
// Values are constrained to a safe charset and length (see parseAttribution in
// src/lib/attribution.ts); invalid values are dropped, never invented, so
// attribution can never inject content into the database or responses.

/** Validates the untrusted attribution payload sent with a lead submission. */
export function parseAttributionPayload(input: SubmitLeadInput): Attribution {
  const attribution = {
    source:
      typeof input.utmSource === "string" ? input.utmSource : undefined,
    medium:
      typeof input.utmMedium === "string" ? input.utmMedium : undefined,
    campaign:
      typeof input.utmCampaign === "string" ? input.utmCampaign : undefined,
    content:
      typeof input.utmContent === "string" ? input.utmContent : undefined,
    term: typeof input.utmTerm === "string" ? input.utmTerm : undefined,
    landingPage:
      typeof input.landingPage === "string" ? input.landingPage : undefined,
  };

  const parsed = parseAttribution(attribution);
  // firstTouchSource is derived from the validated first-touch utm_source.
  return parsed
    ? { ...parsed, firstTouchSource: parsed.source ?? undefined }
    : {};
}

/** Validates untrusted form input; never throws on bad input. */
export function parseLeadInput(
  input: SubmitLeadInput,
): LeadParseResult {
  // Honeypot: bots filling hidden fields are rejected silently.
  if (typeof input.website === "string" && input.website.length > 0) {
    return { ok: false, message: "", fieldErrors: {} };
  }

  // A selected country means the phone must satisfy that country's actual
  // numbering rules, not a hard-coded global digit count.
  const usingCountry = input.phoneCountry !== undefined && input.phoneCountry !== null;
  const validated = usingCountry
    ? validateCountryPhone(input.phoneCountry, input.phone)
    : null;

  const candidate = {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: validated?.ok ? validated.e164 : input.phone,
    email: input.email,
    city: input.city,
    interestType: input.interestType,
    consent: input.consent,
  };

  const parsed = leadSchema.safeParse(candidate);
  const fieldErrors: Record<string, string> = parsed.success
    ? {}
    : (z.flattenError(parsed.error).fieldErrors as Record<string, string>);

  if (validated && !validated.ok) {
    fieldErrors[validated.field] = validated.error;
  }
  // Preserve the old parser's minimum length when no country is supplied.
  // The public Server Action itself requires country selection.
  if (!usingCountry && typeof input.phone === "string" &&
      !/^\+?\d[\d\s\-()]{6,23}$/.test(input.phone.trim())) {
    fieldErrors.phone = "Please enter a valid phone number.";
  }
  if (Object.keys(fieldErrors).length > 0 || !parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Duplicate-submission guard (reasonably practical): if an active lead with the
 * same phone already exists, do not create another record.
 */
export async function findActiveLeadByPhone(normalizedPhone: string) {
  return prisma.lead.findFirst({
    where: {
      phone: normalizedPhone,
      status: { notIn: ["CONVERTED", "NOT_INTERESTED", "DISQUALIFIED"] },
    },
    select: { id: true },
  });
}

/** Generic, safe error response — never exposes database or internal details. */
export const GENERIC_ERROR_MESSAGE =
  "Sorry, something went wrong on our side. Please try again in a moment.";

/**
 * Referral payload resolved server-side by src/lib/referrals.ts (D-034).
 * The public form may only carry a code / display name — the referrer user
 * id itself is NEVER accepted from the client directly.
 */
export type ReferralAttribution = {
  userId: string;
  code: string;
  method: "link" | "manual_name";
  typedName?: string;
  /** Creation-time snapshot of the APPROVED public referral name (both
   * methods), so attribution stays meaningful after code rotation, revocation,
   * or referrer-account deletion. Distinct from typedName, which is the
   * visitor's self-reported spelling for manual_name attribution only. */
  publicReferrerName?: string;
};

/**
 * Persist a validated lead together with its resolved referral (D-034).
 *
 * Atomic scope (Task #027): the lead row, the immutable referral attribution
 * (incl. the creation-time public referrer snapshot), the system initial
 * assignment (the narrow D-034 exception to D-027) and the CRITICAL audit
 * events run as ONE Prisma interactive transaction — either all are written
 * or none of them are.
 *
 * The assignee NOTIFICATION is deliberately OUTSIDE the transaction: it is
 * optional, non-critical state, and an in-transaction insert (even with a
 * swallowed .catch) does not reliably isolate its failure from the interactive
 * transaction. A notification failure therefore cannot roll back a valid
 * lead. Deduplication is preserved by the unique dedupKey. Delivery
 * SEMANTICS (Task #029 correction): notification creation is BEST-EFFORT —
 * there is NO durable retry or outbox, so a failed notification is dropped
 * (never claimed as "at-least-once"); staff always discover assigned leads
 * via their Contacts view. Durable retry/outbox is a possible future
 * enhancement.
 */
export async function persistLead(
  data: z.output<typeof leadSchema>,
  attribution: Attribution = {},
  referral: ReferralAttribution | null = null,
) {
  const lead = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        city: data.city,
        interestType: data.interestType,
        consent: true,
        consentAt: new Date(),
        // Task 1.4 — first-party attribution, only when validly provided:
        utmSource: attribution.source,
        utmMedium: attribution.medium,
        utmCampaign: attribution.campaign,
        utmContent: attribution.content,
        utmTerm: attribution.term,
        landingPage: attribution.landingPage,
        firstTouchSource: attribution.firstTouchSource,
        // D-034 — immutable referral attribution (system-set only; never
        // part of any CRM-facing update path):
        referredByUserId: referral?.userId,
        referralCode: referral?.code,
        referralMethod: referral?.method,
        referredByName: referral?.typedName,
        referredBySnapshot: referral?.publicReferrerName,
        referralCapturedAt: referral ? new Date() : null,
        // D-034 system initial assignment — active Staff referrer becomes
        // the first assignee. deactivated-by-reassignment rules (D-027)
        // continue to apply to every later assignment change.
        assignedUserId: referral?.userId,
        // status intentionally not set here (defaults to NEW_LEAD)
      },
      select: { id: true },
    });

    // Audit trail: capture (system actor) + system assignment event — both
    // CRITICAL for attribution history, so they stay inside the transaction.
    await tx.leadEvent.create({
      data: {
        leadId: lead.id,
        type: "lead_captured",
        metadata: referral ? { referralCode: referral.code, method: referral.method, referredBySnapshot: referral.publicReferrerName } : undefined,
      },
    });
    if (referral) {
      await tx.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "lead_assigned",
          metadata: {
            // D-028: `LeadEvent.userId` is the canonical ACTOR field and must
            // come from the authenticated CRM user. A system assignment has
            // no authenticated actor ⇒ userId stays null; the assignee lives
            // in `metadata.to`. Conceptual separation preserved (D-034):
            //   actor = system | assignee = referring staff member | original
            //   referrer = referring staff member.
            by: "system",
            systemReason: "referral",
            from: null,
            to: referral.userId,
            referralCode: referral.code,
          },
          userId: null,
        },
      });
    }

    return lead;
  });

  // Post-transaction, genuinely isolated notification write (Task #027/#029).
  // Deliberately GENERIC: the body carries NO client personal information,
  // so a later reassignment can never leak lead details to the former
  // assignee's historical notifications. Lead details stay behind the
  // ownership authorization guard at /admin/leads/<id>.
  // tryNewNotification is BEST-EFFORT (Task #029 correction): it swallows
  // its own errors (unique dedupKey violations and transient failures) and
  // can never affect the committed lead. There is NO durable retry or outbox
  // mechanism — a failed notification is currently dropped, and dedupKey
  // only prevents duplicate rows, not loss. Staff always discover assigned
  // leads through their Contacts view; durable retry is a future
  // enhancement, and delivery is never claimed as guaranteed.
  //
  // Task #037 — operational EMAIL alerts (same contract, same guarantees):
  // the assignee (active Staff OR the active Owner with their own referral
  // link) and — when a lead lands in the UNASSIGNED Owner queue — every
  // ACTIVE admin each receive a privacy-conscious new-lead alert email
  // (no client PII, authenticated CRM link only). Email delivery is gated
  // by the operational-email configuration (disabled in production pending
  // Owner approval); failures and disabled state can never block or roll
  // back the committed lead.
  try {
    if (referral) {
      await tryNewNotification({
        userId: referral.userId,
        leadId: lead.id,
        type: "lead_assigned" satisfies (typeof NOTIFICATION_TYPES)[number],
        title: "New referral contact",
        body: "A contact arrived via your referral link and has been added to your Contacts.",
        dedupKey: `lead_assigned:${lead.id}`,
      });
      // Task #037 email alert to the new assignee (Owner or Partner).
      const assignee = await prisma.user.findUnique({
        where: { id: referral.userId },
        select: { name: true, email: true, notificationEmail: true, isActive: true },
      });
      if (assignee?.isActive) {
        await trySendLeadAlertEmail({
          recipientEmail: notificationRecipientEmail(assignee),
          recipientName: assignee.name,
          kind: "assigned_to_you",
          leadId: lead.id,
        });
      }
    } else {
      // Unassigned / Owner queue capture (Task #037 requirement 11):
      // notify every ACTIVE admin only — staff NEVER receive queue alerts
      // (the queue is Owner data under D-027), so unauthorized Staff can
      // never be exposed to queue existence or content.
      const admins = await activeAdminsForQueueAlert();
      for (const admin of admins) {
        await tryRecordAssignmentNotification({
          recipientUserId: admin.id,
          leadId: lead.id,
          kind: "owner_queue",
          dedupKey: `lead_alert:owner_queue:${lead.id}:${admin.id}`,
        });
        await trySendLeadAlertEmail({
          recipientEmail: notificationRecipientEmail(admin),
          recipientName: admin.name,
          kind: "owner_queue",
          leadId: lead.id,
        });
      }
    }
  } catch {
    // Alert orchestration failures are swallowed entirely: the lead is
    // already committed and capture MUST never fail on an alert (Task #037
    // requirement 13). Expected failures (email send, DB hiccup) resolve
    // inside the best-effort helpers above.
  }

  return lead;
}

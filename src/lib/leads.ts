import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { parseAttribution, type Attribution } from "@/lib/attribution";

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
    .max(24, "Phone number is too long.")
    .refine(
      (value) => /^\+?\d[\d\s\-()]{6,23}$/.test(value),
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

  const candidate = {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    city: input.city,
    interestType: input.interestType,
    consent: input.consent,
  };

  const parsed = leadSchema.safeParse(candidate);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: flat.fieldErrors as Record<string, string>,
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
};

/**
 * Persist a validated lead together with its resolved referral (D-034).
 * Runs as ONE Prisma interactive transaction so the immutable referral
 * attribution, the system initial assignment (the narrow D-034 exception to
 * D-027), the audit events and the assignee notification are either all
 * written or none of them are — no partial/racy capture.
 */
export async function persistLead(
  data: z.output<typeof leadSchema>,
  attribution: Attribution = {},
  referral: ReferralAttribution | null = null,
) {
  return prisma.$transaction(async (tx) => {
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
        referralCapturedAt: referral ? new Date() : null,
        // D-034 system initial assignment — active Staff referrer becomes
        // the first assignee. deactivated-by-reassignment rules (D-027)
        // continue to apply to every later assignment change.
        assignedUserId: referral?.userId,
        // status intentionally not set here (defaults to NEW_LEAD)
      },
      select: { id: true },
    });

    // Audit trail: capture (system actor) + system assignment event.
    await tx.leadEvent.create({
      data: {
        leadId: lead.id,
        type: "lead_captured",
        metadata: referral ? { referralCode: referral.code, method: referral.method } : undefined,
      },
    });
    if (referral) {
      await tx.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "lead_assigned",
          metadata: {
            by: "system",
            systemReason: "referral",
            from: null,
            to: referral.userId,
            referralCode: referral.code,
          },
          userId: referral.userId,
        },
      });
      // In-app notification for the assignee (Phase 3). Deduped by unique
      // dedupKey; failures below rollback with the transaction, while the
      // public action never discards a captured lead because of them.
      const leadName = [data.firstName, data.lastName].filter(Boolean).join(" ");
      await tx.notification.create({
        data: {
          userId: referral.userId,
          leadId: lead.id,
          type: "lead_assigned",
          title: "New referral contact",
          body: `${leadName} arrived via your referral link.`,
          dedupKey: `lead_assigned:${lead.id}`,
        },
      }).catch(() => {
        // A duplicate notification insert must not fail capture — the
        // unique dedupKey guarantees idempotence, so swallowing is safe.
      });
    }

    return lead;
  });
}

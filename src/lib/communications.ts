import { prisma } from "@/server/db/prisma";

/**
 * Client Communications (D-034, Phase 4).
 *
 * WhatsApp / click-to-call are LINK OPENERS only: opening them proves
 * nothing about a sent message and no "sent" status is ever recorded
 * because a link opened.
 *
 * Email uses the existing provider-agnostic src/lib/email.ts abstraction
 * (D-021). External sending stays disabled until EMAIL_PROVIDER and the
 * provider credentials are configured and verified (isClientEmailSendingEnabled()).
 */

/**
 * Normalizes an international/local phone number to E.164.
 * Kenyan local formats (07xx/01xx, 7xx/1xx) become +2547XXXXXXXX.
 * Returns null for anything unsafe to link.
 */
export function normalizeToE164(raw: string, defaultCountryCode = "254"): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d+]/g, "");
  const hasPlus = digits.startsWith("+");
  digits = digits.replace(/\+/g, "");

  if (!/^\d{7,15}$/.test(digits)) return null;

  if (hasPlus) {
    return `+${digits}`;
  }

  // Kenyan local normalization (default market):
  //   07XX… / 01XX… (11 digits national)
  if (defaultCountryCode === "254" && digits.length === 10 && digits.startsWith("0")) {
    return `+254${digits.slice(1)}`;
  }
  //   7XX… / 1XX… (9 digits, missing the trunk 0)
  if (defaultCountryCode === "254" && digits.length === 9 && /^[17]/.test(digits)) {
    return `+254${digits}`;
  }
  // 254-prefixed without +
  if (defaultCountryCode === "254" && digits.length === 12 && digits.startsWith("254")) {
    return `+${digits}`;
  }
  // Otherwise treat as already-national (no plus) — refuse to guess.
  return null;
}

/** Official WhatsApp click-to-chat link with a pre-filled, editable message. */
export function buildWhatsAppLink(e164: string, message: string): string | null {
  const digits = e164.replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits)) return null;
  const text = encodeURIComponent(message.slice(0, 600));
  return `https://wa.me/${digits}?text=${text}`;
}

/** Native tel: link for click-to-call. */
export function buildTelLink(e164: string): string | null {
  const digits = e164.replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `tel:+${digits}`;
}

/** Basic recipient sanity check — the ONLY address used is lead.email. */
export function isValidRecipientEmail(email: string | null): email is string {
  if (!email) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) && email.length <= 160;
}

const EMAIL_PROVIDER_ENV = "EMAIL_PROVIDER";

/** The only provider that performs REAL external delivery. */
export function currentEmailProvider(): "resend" | "local" | "disabled" {
  const provider = (process.env[EMAIL_PROVIDER_ENV] || "").toLowerCase();
  if (provider === "resend") return "resend";
  if (provider === "none" && process.env.NEOLIFE_ALLOW_LOCAL_EMAIL === "1")
    return "local";
  return "disabled";
}

/**
 * External client-email sending must be OFF unless a real provider is both
 * COMPLETELY configured (API key AND verified sender address) and explicitly
 * enabled (Owner approval path). Partial configuration stays disabled.
 */
export function isClientEmailSendingEnabled(): boolean {
  return (
    (currentEmailProvider() === "resend" &&
      Boolean(process.env.RESEND_API_KEY) &&
      Boolean(process.env.EMAIL_FROM)) ||
    currentEmailProvider() === "local"
  );
}

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 10000;

// ─── Outbound send safeguards (Task #027, Fix 4) ───────────────────────────

/** Minimum interval between two outbound emails to the SAME contact. */
export const EMAIL_MIN_INTERVAL_PER_LEAD_SECONDS = 90;

/** Rolling hourly cap of outbound emails per sending user. */
export const EMAIL_MAX_PER_SENDER_PER_HOUR = 20;

export type SendPermission =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Server-side outbound email throttle, based on the audit "communication"
 * LeadEvents already recorded per attempt (so it survives restarts and
 * covers all senders of the same lead).
 * - Per-lead interval: prevents repeated sends to the same contact within an
 *   abusive interval, regardless of which staff member sends.
 * - Per-sender hourly cap: prevents mass blasting across many leads.
 * Throws on a transient DB failure? No — fails CLOSED (not allowed) so a
 * monitoring outage can never open a spam window.
 */
export async function checkClientEmailPermission(
  leadId: string,
  userId: string,
): Promise<SendPermission> {
  try {
    const perLeadSince = new Date(
      Date.now() - EMAIL_MIN_INTERVAL_PER_LEAD_SECONDS * 1000,
    );
    const recentForLead = await prisma.leadEvent.count({
      where: {
        leadId,
        type: "communication",
        createdAt: { gte: perLeadSince },
        metadata: { path: ["channel"], equals: "email" },
      },
    });
    if (recentForLead > 0) {
      return {
        allowed: false,
        reason: `An email to this contact was attempted recently. Please wait ${EMAIL_MIN_INTERVAL_PER_LEAD_SECONDS} seconds before sending another one.`,
      };
    }

    const hourAgo = new Date(Date.now() - 3_600_000);
    const sentLastHour = await prisma.leadEvent.count({
      where: {
        type: "communication",
        userId,
        createdAt: { gte: hourAgo },
        metadata: { path: ["channel"], equals: "email" },
      },
    });
    if (sentLastHour >= EMAIL_MAX_PER_SENDER_PER_HOUR) {
      return {
        allowed: false,
        reason: `Hourly sending limit of ${EMAIL_MAX_PER_SENDER_PER_HOUR} emails reached. Please try again later.`,
      };
    }

    return { allowed: true };
  } catch {
    // Fail closed: don't send while we cannot verify the limits.
    return {
      allowed: false,
      reason: "Sending is temporarily unavailable. Please try again shortly. Nothing was sent.",
    };
  }
}

export type SendClientEmailResult =
  | { ok: true; provider: string; status: "sent" | "logged" }
  | { ok: false; error: string; provider?: string; status?: "failed" };

export function validateComposerInput(subject: unknown, body: unknown): { subject: string; body: string } | null {
  if (typeof subject !== "string" || typeof body !== "string") return null;
  const s = subject.trim();
  const b = body;
  if (s.length === 0 || s.length > MAX_SUBJECT_LENGTH) return null;
  if (b.trim().length === 0 || b.length > MAX_BODY_LENGTH) return null;
  return { subject: s, body: b };
}

/** Records a limited-data audit event for a client communication attempt. */
export async function recordCommunicationEvent(input: {
  leadId: string;
  userId: string;
  channel: "email" | "whatsapp_opened" | "call_intended";
  subject?: string;
  providerStatus?: string;
}): Promise<void> {
  try {
    await prisma.leadEvent.create({
      data: {
        leadId: input.leadId,
        type: "communication",
        metadata: {
          channel: input.channel,
          subject: input.subject?.slice(0, MAX_SUBJECT_LENGTH),
          providerStatus: input.providerStatus?.slice(0, 200),
          // Body and recipient address are intentionally NOT stored (data
          // minimisation): the address lives on the Lead; the body is PII.
        },
        userId: input.userId,
      },
    });
  } catch {
    // Audit is best-effort: a transient failure must not lose a sent email's UX.
  }
}

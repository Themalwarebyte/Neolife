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

// ─── Outbound send safeguards (Task #029, Fix 4) ───────────────────────────

/** Minimum interval between two outbound emails to the SAME contact. */
export const EMAIL_MIN_INTERVAL_PER_LEAD_SECONDS = 90;

/** Rolling hourly cap of outbound emails per sending user. */
export const EMAIL_MAX_PER_SENDER_PER_HOUR = 20;

/** Reservation row is created BEFORE the provider call — never after. */
export type EmailSendReservationResult =
  | { allowed: true; reservationId: string }
  | { allowed: false; reason: string };

/** Terminal/latching statuses for a reservation row. */
export type EmailSendStatus =
  | "reserved"
  | "accepted"
  | "failed"
  | "unknown"
  | "simulated";

/**
 * Map a provider result to the reservation status.
 * "accepted" means ONLY that a real provider accepted the message — never
 * that it was delivered. Network failures, 5xx responses and any non-HTTP
 * error are "unknown": the message may have gone out, so the caller must NOT
 * blindly resend and the audit trail records the uncertainty. 4xx responses
 * are definitive provider rejections ("failed").
 */
export function classifySendOutcome(
  provider: string,
  result: { ok: boolean; error?: string },
): Exclude<EmailSendStatus, "reserved"> {
  if (!result.ok) {
    if (provider === "local") return "failed";
    if (
      provider === "resend" &&
      /resend_http_4\d\d/.test(result.error ?? "")
    ) {
      // Definitive provider rejection — the message was NOT accepted.
      return "failed";
    }
    // resend 5xx / network failure / timeout / other provider: the message
    // MAY have been accepted — never claim failure or success blindly.
    return "unknown";
  }
  if (provider === "resend") return "accepted";
  if (provider === "local") return "simulated";
  return "unknown";
}

/**
 * Reserve the right to send one outbound email (Task #029, Fix 4).
 *
 * Race-safe by construction: the reserved send slots are counted and the
 * reservation row inserted inside ONE short transaction (identity: leadId +
 * sending user) serialized by a two-key PostgreSQL advisory transaction lock
 * (deterministic ordered pair ⇒ no deadlock across concurrent claims). The
 * lock is released when the transaction COMMITS, so no long transaction is
 * ever held open during a provider call.
 *
 * Conservative counting: EVERY reservation row counts against both limits,
 * regardless of its status — including "failed", "unknown" and rows left in
 * "reserved" when the provider call crashed — so failures can never reopen
 * the limit and duplicate client/browser retries are refused inside the
 * per-lead interval.
 */
export async function reserveClientEmailSend(
  leadId: string,
  userId: string,
): Promise<EmailSendReservationResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Deterministic-name advisory keys: encode two bounded ints (Prisma
      // supports the two-KEY two-argument form: pg_advisory_xact_lock(bigint,
      // bigint)). We use fixed keys for CLIENT_EMAIL_USER(1)/CLIENT_EMAIL_LEAD(1).
      // Ordering: the user-scope lock first, then the lead-scope lock, in the
      // same order in every claim ⇒ no lock-order deadlock.
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(1, 1), pg_advisory_xact_lock(2, 1)`,
      );

      const perLeadSince = new Date(
        Date.now() - EMAIL_MIN_INTERVAL_PER_LEAD_SECONDS * 1000,
      );
      const recentForLead = await tx.emailSendReservation.count({
        where: { leadId, reservedAt: { gte: perLeadSince } },
      });
      if (recentForLead > 0) {
        return {
          allowed: false,
          reason: `An email to this contact was attempted recently. Please wait ${EMAIL_MIN_INTERVAL_PER_LEAD_SECONDS} seconds before sending another one.` as const satisfies string,
        };
      }

      const hourAgo = new Date(Date.now() - 3_600_000);
      const sentLastHour = await tx.emailSendReservation.count({
        where: { userId, reservedAt: { gte: hourAgo } },
      });
      if (sentLastHour >= EMAIL_MAX_PER_SENDER_PER_HOUR) {
        return {
          allowed: false,
          reason: `Hourly sending limit of ${EMAIL_MAX_PER_SENDER_PER_HOUR} emails reached. Please try again later.` as const satisfies string,
        };
      }

      const created = await tx.emailSendReservation.create({
        data: { leadId, userId, status: "reserved" },
        select: { id: true },
      });
      return { allowed: true, reservationId: created.id } as const;
    });
  } catch {
    // Fail closed: don't send while the reservation cannot be verified.
    return {
      allowed: false,
      reason: "Sending is temporarily unavailable. Please try again shortly. Nothing was sent.",
    };
  }
}

/**
 * Latch the final status of a reservation AFTER the provider interaction.
 * Called independently of the CRM audit trail: if the leadEvent audit write
 * fails, the reservation state still records what happened to the attempt;
 * if THIS update fails, the row remains "reserved" — conservative, because
 * it keeps counting against the limits.
 */
export async function finalizeClientEmailReservation(
  reservationId: string,
  status: Exclude<EmailSendStatus, "reserved">,
): Promise<number> {
  try {
    const updated = await prisma.emailSendReservation.updateMany({
      where: { id: reservationId },
      data: { status },
    });
    return updated.count;
  } catch {
    return 0; // row (if any) stays "reserved" — conservative
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

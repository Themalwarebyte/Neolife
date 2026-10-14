import { sendMail, type SendMailResult } from "@/lib/email";
import { prisma } from "@/server/db/prisma";
import { NOTIFICATION_TYPES, tryNewNotification } from "@/lib/notifications";

/**
 * Operational email notifications (Task #037).
 *
 * Scope: INTERNAL alerts to CRM users (assignment alerts, Owner-queue
 * alerts). Client-facing email remains in src/app/admin/(protected)/
 * actions.ts (sendClientEmail) with its own authorization and throttle rules.
 *
 * PRIVACY-CONSCIOUS BY CONSTRUCTION (Task #037 requirement 12): alert
 * emails carry ONLY the recipient's name, the event kind, and an
 * authenticated CRM link. No client PII — not even the lead's name, phone
 * or email — ever leaves the CRM in these notifications. Lead details stay
 * behind the ownership authorization guard at /admin/leads/<id>.
 *
 * DELIVERY SEMANTICS (reported honestly, Task #037 requirement 13):
 * - Sending is BEST-EFFORT and NON-BLOCKING: every failure is caught;
 *   lead capture / assignment mutations NEVER fail or roll back because an
 *   alert email could not be sent.
 * - There is NO durable outbox or automatic retry: a failed (or disabled)
 *   alert is dropped. The in-app Notification row is the durable record
 *   (deduplicated by its unique dedupKey), and users always discover
 *   assigned/unassigned leads through the CRM lists.
 * - "ok" from the provider means ACCEPTED only — never confirmed delivery.
 */

/** Env flag that turns real operational email delivery ON (Owner approval). */
export const OPERATIONAL_EMAIL_ENABLED_ENV = "NEOLIFE_OPERATIONAL_EMAIL_ENABLED";

/**
 * External operational email stays DISABLED unless BOTH conditions hold:
 *  1. a real provider is fully configured (EMAIL_PROVIDER=resend with
 *     RESEND_API_KEY + EMAIL_FROM — src/lib/email.ts), and
 *  2. the explicit Owner-approval flag NEOLIFE_OPERATIONAL_EMAIL_ENABLED=1
 *     is set.
 * Production therefore keeps sending disabled until the separate deployment
 * and configuration approval (Task #037 requirement 15).
 */
export function isOperationalEmailSendingEnabled(): boolean {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (provider !== "resend") return false;
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  return process.env[OPERATIONAL_EMAIL_ENABLED_ENV] === "1";
}

/**
 * The address where a user receives operational notifications:
 * their explicit notificationEmail preference when set, else the login email.
 */
export function notificationRecipientEmail(user: {
  notificationEmail?: string | null;
  email: string;
}): string {
  const preferred = user.notificationEmail?.trim();
  return preferred || user.email;
}

/**
 * Who should receive "lead entered the unassigned Owner queue" alerts:
 * every ACTIVE admin (Owner). Inactive admins are never notified and staff
 * NEVER receive queue alerts — that data stays with the Owner (D-027).
 */
export function ownerQueueRecipientEmails(
  admins: Array<{ role: string; isActive: boolean; email: string; notificationEmail?: string | null }>,
): string[] {
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const admin of admins) {
    if (admin.role !== "admin" || !admin.isActive) continue;
    const email = notificationRecipientEmail(admin);
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push(email);
  }
  return recipients;
}

/** Base CRM origin for alert links (no request context needed). */
export function crmBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.BETTER_AUTH_URL ||
    "https://neolife.ooflowdesk.com"
  ).replace(/\/+$/, "");
}

export type LeadAlertKind = "assigned_to_you" | "owner_queue";

export type BuildLeadAlertInput = {
  kind: LeadAlertKind;
  baseUrl: string;
  leadId: string;
};

/**
 * Pure builder for a privacy-conscious new-lead alert.
 * Returns null when the input is structurally invalid (never throws).
 * The ONLY variable content is the recipient's name and the CRM path.
 */
export function buildNewLeadAlertEmail(input: BuildLeadAlertInput, recipientName: string): {
  subject: string;
  text: string;
  html: string;
} | null {
  const leadPath =
    typeof input.leadId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.leadId)
      ? `/admin/leads/${input.leadId}`
      : null;
  if (!leadPath) return null;
  const base = input.baseUrl.replace(/\/+$/, "");
  const link = `${base}${leadPath}`;
  const safeName = recipientName.trim().replace(/[<>&"']/g, "").slice(0, 80);
  const context =
    input.kind === "assigned_to_you"
      ? "A new contact has been assigned to you in the NEOLIFE CRM."
      : "A new contact has arrived in the unassigned Owner queue of the NEOLIFE CRM.";
  const subject =
    input.kind === "assigned_to_you"
      ? "New lead assigned to you — NEOLIFE CRM"
      : "New lead in the unassigned queue — NEOLIFE CRM";
  const text = [
    `Hi ${safeName},`,
    "",
    context,
    "Open your CRM to view it (sign-in required):",
    link,
    "",
    "This is an automated alert from the NEOLIFE office platform. Client details are only visible inside the CRM.",
  ].join("\n");
  const html = [
    '<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;">',
    `<p>Hi ${safeName},</p>`,
    `<p>${context}</p>`,
    `<p><a href="${link}" style="color:#047857;font-weight:600;">Open the CRM</a> (sign-in required)</p>`,
    '<p style="font-size:12px;color:#6b7280;">Automated alert from the NEOLIFE office platform. Client details are only visible inside the CRM.</p>',
    "</div>",
  ].join("");
  return { subject, text, html };
}

export type TryLeadAlertOutcome = {
  attempted: boolean;
  ok: boolean;
  /** disabled = sending is off; nothing was attempted and nothing is lost:
   * the in-app Notification below is the durable record. */
  status: "sent" | "failed" | "disabled" | "skipped";
  error?: string;
};

/**
 * Send ONE assignment alert email to ONE recipient. Best-effort and
 * non-blocking by contract: catches everything, never throws, never blocks
 * the lead-capture or assignment paths. Descriptive errors are returned for
 * audit/reporting only — callers must treat success of the CRM mutation as
 * independent of this result.
 */
export async function trySendLeadAlertEmail(input: {
  recipientEmail: string;
  recipientName: string;
  kind: LeadAlertKind;
  leadId: string;
}): Promise<TryLeadAlertOutcome> {
  if (!isOperationalEmailSendingEnabled()) {
    return { attempted: false, ok: false, status: "disabled" };
  }
  const built = buildNewLeadAlertEmail(
    { kind: input.kind, baseUrl: crmBaseUrl(), leadId: input.leadId },
    input.recipientName,
  );
  if (!built) {
    return { attempted: false, ok: false, status: "skipped", error: "invalid_alert_input" };
  }
  try {
    const result: SendMailResult = await sendMail({
      to: input.recipientEmail,
      subject: built.subject,
      text: built.text,
      html: built.html,
    });
    return result.ok
      ? { attempted: true, ok: true, status: "sent" }
      : { attempted: true, ok: false, status: "failed", error: result.error };
  } catch (error) {
    // Never throw — notifications can never break lead capture (Task #037).
    return {
      attempted: true,
      ok: false,
      status: "failed",
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/**
 * Durable in-app notification for an assignment event. One per
 * (lead, recipient): a genuine reassign-away-and-back will not re-create the
 * in-app row for the same user, while the EMAIL alert above is deliberately
 * re-sent per occurrence (the assignment mutation itself is the gate against
 * duplicate sends, not a dedupKey). Best-effort: failures are swallowed.
 */
export async function tryRecordAssignmentNotification(input: {
  recipientUserId: string;
  leadId: string;
  kind: LeadAlertKind;
  /** Unique within the (lead, kind, user) scope — supplied by the caller so
   * the capture path and the manual-assignment path keep their own
   * deduplication domains (the capture path's legacy key
   * `lead_assigned:<leadId>` is preserved unchanged). */
  dedupKey: string;
}): Promise<boolean> {
  return tryNewNotification({
    userId: input.recipientUserId,
    leadId: input.leadId,
    type: "lead_assigned" satisfies (typeof NOTIFICATION_TYPES)[number],
    title:
      input.kind === "assigned_to_you"
        ? "New lead assigned to you"
        : "New lead in the unassigned queue",
    body:
      input.kind === "assigned_to_you"
        ? "A new contact has been assigned to you and is waiting in your Contacts."
        : "A new contact has arrived in the unassigned Owner queue.",
    dedupKey: input.dedupKey,
  });
}

/**
 * Active admins to alert when a lead lands in the unassigned Owner queue.
 * Notification CANNOT expose queue data to Staff: only role=admin (active)
 * users are ever selected here (D-027).
 */
export async function activeAdminsForQueueAlert(): Promise<
  Array<{ id: string; email: string; notificationEmail: string | null; name: string }>
> {
  return prisma.user.findMany({
    where: { role: "admin", isActive: true },
    select: { id: true, email: true, notificationEmail: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

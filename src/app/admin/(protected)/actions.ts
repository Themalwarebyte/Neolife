"use server";

import { revalidatePath } from "next/cache";
import { headers as nextHeaders } from "next/headers";
import { requireAdmin, requireCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";
import {
  parseFollowUpNote,
  parseStatusChange,
} from "@/lib/leadManagement";
import {
  parseMeetingStatus,
  parseOptionalText,
  parseScheduledAt,
} from "@/lib/meetingManagement";
import {
  createUserSchema,
  toggleUserSchema,
  changePasswordSchema,
  isValidBetterAuthUserId,
} from "@/lib/user-management";
import { randomBytes } from "node:crypto";
import { LeadStatus, MeetingStatus } from "@/generated/prisma/client";
import {
  classifySendOutcome,
  currentEmailProvider,
  finalizeClientEmailReservation,
  isClientEmailSendingEnabled,
  isValidRecipientEmail,
  recordCommunicationEvent,
  reserveClientEmailSend,
  validateComposerInput,
} from "@/lib/communications";
import {
  findActivePublicNameConflict,
  isReferralEligibleRole,
  normalizePublicName,
  publicNameKey,
} from "@/lib/referrals";
import { sendMail } from "@/lib/email";
import {
  notificationRecipientEmail,
  tryRecordAssignmentNotification,
  trySendLeadAlertEmail,
} from "@/lib/notificationsEmail";
import { Prisma } from "@/generated/prisma/client";

// ─── Referral link management (D-034) ────────────────────────────────────

const REFERRAL_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function newReferralCode(): string {
  const bytes = randomBytes(22);
  let code = "";
  for (const byte of bytes) {
    code += REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Owner-only: (re)generate the referral link for a referral-eligible user.
 * Task #037: eligibility is active Staff AND the active Owner, so the Owner
 * can hold his own personal referral link. Regenerating replaces the old
 * code — a previously shared link stops resolving, which is an intentional,
 * Owner-controlled rotation.
 */
export async function generateStaffReferralLink(formData: FormData): Promise<CrmActionResult> {
  await requireAdmin();
  const staffUserId = String(formData.get("staffUserId") ?? "").trim();
  const publicName = String(formData.get("publicName") ?? "").trim();

  if (!isValidBetterAuthUserId(staffUserId)) {
    return { status: "error", message: "Invalid user." };
  }
  const normalizedPublicName = normalizePublicName(publicName);
  if (
    !normalizedPublicName ||
    normalizedPublicName.length < 2 ||
    normalizedPublicName.length > 60
  ) {
    return {
      status: "error",
      message: "Public name must be 2–60 characters.",
    };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { id: true, role: true, isActive: true, name: true },
    });
    if (!target || !target.isActive || !isReferralEligibleRole(target.role)) {
      return { status: "error", message: "Active referral-eligible user not found." };
    }

    // Task #027 — prevent duplicate ACTIVE public referral names: an
    // ambiguous name must never exist among active staff, because the manual
    // fallback refuses to guess between two matching members.
    const clash = await findActivePublicNameConflict(
      normalizedPublicName,
      staffUserId,
    );
    if (clash) {
      return {
        status: "error",
        message:
          "That public name is already used by another active team member with a referral link. Pick a different one.",
      };
    }

    const code = newReferralCode();
    // Task #029 (Fix 2): storage, lookup and display all use the NORMALIZED
    // name. publicName keeps normalized form with its original casing for
    // display; publicNameNormal is the lower-cased equality key protected by
    // a unique constraint, which enforces the duplicate-name rule RACE-SAFE.
    const storedPublicName = normalizedPublicName;
    const nameKey = publicNameKey(normalizedPublicName);
    try {
      await prisma.referralCode.upsert({
        where: { userId: staffUserId },
        update: {
          code,
          publicName: storedPublicName,
          publicNameNormal: nameKey,
          isActive: true,
          revokedAt: null,
        },
        create: {
          userId: staffUserId,
          code,
          publicName: storedPublicName,
          publicNameNormal: nameKey,
        },
      });
    } catch (error) {
      // Race-safe duplicate enforcement (Task #029): losing the concurrent
      // registration to the unique constraint is a normal, handled outcome —
      // never an unexplained failure.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return {
          status: "error",
          message:
            "That public name is already used by another active team member with a referral link. Pick a different one.",
        };
      }
      throw error;
    }

    revalidatePath("/admin/referrals");
    return {
      status: "success",
      message: `Referral link updated for ${target.name}.`,
    };
  } catch {
    return { status: "error", message: "Could not update the referral link." };
  }
}

/** Owner-only: revoke a referral link (existing links fail safely). */
export async function revokeStaffReferralLink(formData: FormData): Promise<CrmActionResult> {
  await requireAdmin();
  const staffUserId = String(formData.get("staffUserId") ?? "").trim();
  if (!isValidBetterAuthUserId(staffUserId)) {
    return { status: "error", message: "Invalid staff user." };
  }
  try {
    const updated = await prisma.referralCode.updateMany({
      where: { userId: staffUserId, revokedAt: null },
      // Task #029 (Fix 2): clearing the normalized key frees the name for
      // reuse — NULLs are exempt from the unique constraint, so the name can
      // be re-registered later without stale-key collisions.
      data: {
        isActive: false,
        revokedAt: new Date(),
        publicNameNormal: null,
      },
    });
    revalidatePath("/admin/referrals");
    return updated.count > 0
      ? { status: "success", message: "Referral link revoked." }
      : { status: "error", message: "No active referral link found." };
  } catch {
    return { status: "error", message: "Could not revoke the referral link." };
  }
}

/**
 * Staff-safe: return the CURRENT USER's own referral link data (or null).
 * Staff can see and copy their own link only; the Owner sees all via the
 * /admin/referrals page.
 */
export async function getMyReferralLink() {
  const user = await requireCrmUser();
  const record = await prisma.referralCode.findUnique({
    where: { userId: user.id },
    select: { code: true, isActive: true, revokedAt: true, publicName: true },
  });
  if (!record || !record.isActive || record.revokedAt) return null;
  const headerList = await nextHeaders();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    headerList.get("origin") ??
    "https://neolife.ooflowdesk.com";
  return {
    code: record.code,
    publicName: record.publicName,
    link: `${origin.replace(/\/+$/, "")}/business?ref=${encodeURIComponent(record.code)}`,
  };
}

export type CrmActionResult = { status: "success" | "error"; message: string };

/**
 * Lead, meeting, and event IDs are generated by PostgreSQL's
 * gen_random_uuid(), so a strict UUID check is correct for them. It is NOT
 * correct for user IDs: Better Auth generates opaque ~32-char alphanumeric
 * User.id values, and assuming UUIDs for targetUserId made assignLead reject
 * every real Staff assignee (see Task P-2 Better Auth ID validation).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns [leadId, ownershipError]. On success ownershipError is null. */
async function verifyLeadOwnership(
  user: { id: string; role: string },
  leadId: string,
): Promise<[string | null, CrmActionResult | null]> {
  if (!UUID.test(leadId)) {
    return [null, { status: "error", message: "Invalid lead." }];
  }
  const where =
    user.role === "admin"
      ? { id: leadId }
      : { id: leadId, assignedUserId: user.id };

  const lead = await prisma.lead.findUnique({ where, select: { id: true } });
  if (!lead) {
    return [null, { status: "error", message: "Lead not found." }];
  }
  return [leadId, null];
}

/** Updates a lead's lifecycle status and records a status-change event. */
export async function updateLeadStatus(
  _previous: CrmActionResult | null,
  formData: FormData,
): Promise<CrmActionResult> {
  const user = await requireCrmUser();
  const id = String(formData.get("id") ?? "");
  const status = parseStatusChange(formData.get("status"));
  if (!UUID.test(id)) return { status: "error", message: "Invalid lead." };
  if (!status) return { status: "error", message: "Invalid status." };

  try {
    const [leadId, ownershipErr] = await verifyLeadOwnership(user, id);
    if (!leadId || ownershipErr) return ownershipErr!;

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: { status: status as LeadStatus },
      }),
      prisma.leadEvent.create({
        data: {
          leadId,
          type: "status_changed",
          metadata: { status },
          userId: user.id,
        },
      }),
    ]);

    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${id}`);
    return { status: "success", message: "Status updated." };
  } catch {
    return { status: "error", message: "Could not update the lead." };
  }
}

/** Records a follow-up note for a lead. */
export async function addFollowUp(
  _previous: CrmActionResult | null,
  formData: FormData,
): Promise<CrmActionResult> {
  const user = await requireCrmUser();
  const id = String(formData.get("id") ?? "");
  const note = parseFollowUpNote(formData.get("note"));
  if (!UUID.test(id)) return { status: "error", message: "Invalid lead." };
  if (!note) return { status: "error", message: "Please enter a follow-up note." };

  try {
    const [leadId, ownershipErr] = await verifyLeadOwnership(user, id);
    if (!leadId || ownershipErr) return ownershipErr!;

    await prisma.$transaction([
      prisma.followUp.create({ data: { leadId, note } }),
      prisma.leadEvent.create({
        data: { leadId, type: "follow_up_added", userId: user.id },
      }),
    ]);

    revalidatePath(`/admin/leads/${id}`);
    return { status: "success", message: "Follow-up recorded." };
  } catch {
    return { status: "error", message: "Could not record the follow-up." };
  }
}

/** Schedules an office meeting for a lead (Task 1.8). */
export async function scheduleMeeting(
  _previous: CrmActionResult | null,
  formData: FormData,
): Promise<CrmActionResult> {
  const user = await requireCrmUser();
  const leadId = String(formData.get("leadId") ?? "");
  const scheduledAt = parseScheduledAt(formData.get("scheduledAt"));
  const notes = parseOptionalText(formData.get("notes"));
  if (!UUID.test(leadId)) return { status: "error", message: "Invalid lead." };
  if (!scheduledAt) {
    return { status: "error", message: "Please provide a valid date and time." };
  }
  if (notes === null) return { status: "error", message: "Notes are too long." };

  try {
    const [ownedLeadId, ownershipErr] = await verifyLeadOwnership(user, leadId);
    if (!ownedLeadId || ownershipErr) return ownershipErr!;

    await prisma.$transaction([
      prisma.meeting.create({
        data: { leadId: ownedLeadId, scheduledAt, notes: notes ?? null },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: ownedLeadId,
          type: "meeting_scheduled",
          metadata: { scheduledAt: scheduledAt.toISOString() },
          userId: user.id,
        },
      }),
    ]);

    revalidatePath(`/admin/leads/${leadId}`);
    return { status: "success", message: "Meeting scheduled." };
  } catch {
    return { status: "error", message: "Could not schedule the meeting." };
  }
}

/** Updates a meeting's status/outcome/notes (Task 1.8). */
export async function updateMeeting(
  _previous: CrmActionResult | null,
  formData: FormData,
): Promise<CrmActionResult> {
  const user = await requireCrmUser();
  const meetingId = String(formData.get("meetingId") ?? "");
  const status = parseMeetingStatus(formData.get("status"));
  const outcome = parseOptionalText(formData.get("outcome"));
  const notes = parseOptionalText(formData.get("notes"));
  if (!UUID.test(meetingId)) {
    return { status: "error", message: "Invalid meeting." };
  }
  if (!status) return { status: "error", message: "Invalid meeting status." };
  if (outcome === null || notes === null) {
    return { status: "error", message: "Outcome/notes are too long." };
  }

  try {
    // Owner sees all meetings. Staff sees only meetings on their assigned leads.
    const meeting = await prisma.meeting.findUnique({
      where:
        user.role === "admin"
          ? { id: meetingId }
          : {
              id: meetingId,
              lead: { assignedUserId: user.id },
            },
      select: { id: true, leadId: true },
    });
    if (!meeting) return { status: "error", message: "Meeting not found." };

    await prisma.$transaction([
      prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: status as MeetingStatus,
          outcome: outcome ?? null,
          notes: notes ?? null,
        },
      }),
      prisma.leadEvent.create({
        data: {
          leadId: meeting.leadId,
          type: "meeting_status_changed",
          metadata: { status },
          userId: user.id,
        },
      }),
    ]);

    revalidatePath(`/admin/leads/${meeting.leadId}`);
    return { status: "success", message: "Meeting updated." };
  } catch {
    return { status: "error", message: "Could not update the meeting." };
  }
}

/**
 * Owner-only: list Staff users available as lead assignees.
 * Returns only non-admin users sorted by name — admin users are never selectable.
 */
export async function getCrmUsers() {
  await requireAdmin();
  const staff = await prisma.user.findMany({
    where: { role: "staff" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  return staff;
}

/** Owner-only: assign or reassign a lead to a Staff user (or unassign). */
export async function assignLead(
  _previous: CrmActionResult | null,
  formData: FormData,
): Promise<CrmActionResult> {
  // Owner-only: requireAdmin throws/redirects for non-admins.
  const admin = await requireAdmin();

  const leadId = String(formData.get("leadId") ?? "");
  const targetUserId = String(formData.get("assignedUserId") ?? "").trim();

  if (!UUID.test(leadId)) return { status: "error", message: "Invalid lead." };

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, assignedUserId: true },
    });
    if (!lead) return { status: "error", message: "Lead not found." };

    if (targetUserId === "") {
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: leadId },
          data: { assignedUserId: null },
        }),
        prisma.leadEvent.create({
          data: {
            leadId,
            type: "lead_unassigned",
            metadata: { by: admin.id, from: lead.assignedUserId ?? null },
            userId: admin.id,
          },
        }),
      ]);
      revalidatePath("/admin/leads");
      revalidatePath(`/admin/leads/${leadId}`);
      return { status: "success", message: "Lead unassigned." };
    }

    if (!isValidBetterAuthUserId(targetUserId)) {
      return { status: "error", message: "Invalid assignee." };
    }

    // Validate target: must be a Staff user (not admin, not arbitrary ID).
    // Task #037: notificationEmail is selected for the non-blocking alert.
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, name: true, email: true, notificationEmail: true },
    });
    if (!target) {
      return { status: "error", message: "Assignee not found." };
    }
    if (target.role !== "staff") {
      // Non-Staff roles (including admin) are never valid assignees.
      return { status: "error", message: "Assignee must be a staff user." };
    }

    if (target.id === lead.assignedUserId) {
      return {
        status: "success",
        message: "Lead is already assigned to that user.",
      };
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: { assignedUserId: target.id },
      }),
      prisma.leadEvent.create({
        data: {
          leadId,
          type: "lead_assigned",
          metadata: {
            by: admin.id,
            from: lead.assignedUserId ?? null,
            to: target.id,
          },
          userId: admin.id,
        },
      }),
    ]);

    // Task #037 — privacy-conscious operational alert to the new assignee,
    // strictly AFTER the committed transaction and best-effort: every alert
    // helper swallows its own errors, so an email outage can never fail the
    // assignment mutation. The in-app row is durable (own dedup domain per
    // lead+user so reassignment away-and-back still notifies once each); the
    // email carries NO client PII — only an authenticated CRM link.
    try {
      await tryRecordAssignmentNotification({
        recipientUserId: target.id,
        leadId,
        kind: "assigned_to_you",
        dedupKey: `lead_alert:assigned_to_you:${leadId}:${target.id}`,
      });
      await trySendLeadAlertEmail({
        recipientEmail: notificationRecipientEmail(target),
        recipientName: target.name,
        kind: "assigned_to_you",
        leadId,
      });
    } catch {
      // Never propagate: the assignment itself is already committed.
    }

    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${leadId}`);
    return { status: "success", message: `Lead assigned to ${target.name}.` };
  } catch {
    return { status: "error", message: "Could not assign the lead." };
  }
}

export async function createCrmUser(
  _prevState: unknown,
  formData: FormData,
): Promise<CrmActionResult> {
  await requireAdmin();

  const result = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return { status: "error", message: result.error.issues[0].message };
  }

  const { name, email, password } = result.data;

  try {
    const { auth } = await import("@/lib/auth");
    const signUpRes = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });

    const userId = signUpRes?.user?.id;
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "staff", mustChangePassword: true },
      });
    }

    return {
      status: "success",
      message: "User created successfully.",
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Could not create user.";
    if (msg.toLowerCase().includes("email already in use")) {
      return { status: "error", message: "Email is already in use." };
    }
    return { status: "error", message: "Could not create user." };
  }
}

export async function toggleUserActive(userId: string): Promise<void> {
  const admin = await requireAdmin();

  const result = toggleUserSchema.safeParse({ userId });
  if (!result.success) {
    return;
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: result.data.userId },
      select: { isActive: true, role: true },
    });

    if (!target) {
      return;
    }

    if (target.role === "admin") {
      return;
    }

    if (result.data.userId === admin.id) {
      return;
    }

    await prisma.user.update({
      where: { id: result.data.userId },
      data: { isActive: !target.isActive },
    });

    revalidatePath("/admin/users");
  } catch {
    return;
  }
}

// ─── Client communications (D-034, Phase 4) ───────────────────────────────

const COMMUNICATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sends an email to the AUTHORIZED lead's own address — never to an address
 * chosen in the form. Staff may email only leads currently assigned to
 * them; the Owner may email any lead. The recipient is resolved server-side
 * from the Lead record, so arbitrary recipient substitution is impossible.
 * External sending stays disabled until a provider is configured (D-021);
 * the action then records an audit event with the provider status either way.
 */
export async function sendClientEmail(
  _previous: CrmActionResult | null,
  formData: FormData,
): Promise<CrmActionResult> {
  const user = await requireCrmUser();

  const leadId = String(formData.get("leadId") ?? "");
  if (!COMMUNICATION_UUID.test(leadId)) {
    return { status: "error", message: "Invalid lead." };
  }

  const parsed = validateComposerInput(formData.get("subject"), formData.get("body"));
  if (!parsed) {
    return {
      status: "error",
      message: "Please provide a subject and a message (body up to 10,000 characters).",
    };
  }

  try {
    // Ownership-scoped lookup: Staff only reach their OWN assigned leads.
    const lead = await prisma.lead.findUnique({
      where:
        user.role === "admin"
          ? { id: leadId }
          : { id: leadId, assignedUserId: user.id },
      select: { id: true, email: true, firstName: true, consent: true },
    });
    if (!lead) return { status: "error", message: "Lead not found." };

    if (!lead.consent) {
      return {
        status: "error",
        message:
          "This contact has not consented to being contacted. Nothing was sent.",
      };
    }

    if (!lead.email || !isValidRecipientEmail(lead.email)) {
      return {
        status: "error",
        message: "This contact has no usable email address on record.",
      };
    }

    if (!isClientEmailSendingEnabled()) {
      return {
        status: "error",
        message:
          "Email sending is not enabled yet: configure the delivery provider first. Nothing was sent.",
      };
    }

    // Task #029 (Fix 4) — race-safe outbound throttle: a durable reservation
    // row is inserted ATOMICALLY (advisory-lock-serialized short transaction)
    // BEFORE any provider call, so simultaneous requests can never bypass the
    // per-lead interval or the per-sender hourly cap. The reservation is also
    // the persisted attempt identity for the audit trail. The lock releases
    // at COMMIT — no long transaction is held open during the provider call.
    const reservation = await reserveClientEmailSend(lead.id, user.id);
    if (!reservation.allowed) {
      return { status: "error", message: reservation.reason };
    }

    const { subject, body } = parsed;
    const escaped = body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    const provider = currentEmailProvider();
    // Task #037 — Reply-To (requirement 14): replies to a client email land
    // in the AUTHORIZED SENDER's own CRM mailbox (their authenticated User
    // email). The From identity still remains the business sender
    // (EMAIL_FROM = "GHub Technologies-Neolife <noreply@mail.ooflowdesk.com>"),
    // so the mailbox never depends on a client-controlled value and replies
    // can never be redirected by crafted content. Inbound replies are NOT
    // synchronized into the CRM (no inbound mail integration is implemented).
    const result = await sendMail({
      to: lead.email,
      subject,
      text: body,
      replyTo: user.email,
      html: `<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;">${escaped}</p><p style="font-family:system-ui,sans-serif;font-size:12px;color:#6b7280;">NEOLIFE Office Team</p>`,
    });

    // Status reporting must be accurate (Task #027/#029): "accepted" only
    // means a REAL provider accepted the request — never that it was
    // delivered; timeouts/5xx/network errors map to "unknown" (the message
    // may have gone out, so no blind resend is offered); 4xx map to
    // "failed"; local simulation is labeled as simulation.
    const sendStatus = classifySendOutcome(provider, result);
    const providerStatus = `${provider}:${sendStatus}${
      result.ok ? "" : `:${result.error ?? "unknown"}`
    }`;

    await recordCommunicationEvent({
      leadId: lead.id,
      userId: user.id,
      channel: "email",
      subject,
      providerStatus,
    });

    // Latch the reservation status independently of the CRM audit trail: if
    // the audit event above failed, the reservation still records the
    // attempt; if THIS update fails, the row stays "reserved" — conservative
    // against the limits either way.
    await finalizeClientEmailReservation(reservation.reservationId, sendStatus);

    revalidatePath(`/admin/leads/${lead.id}`);

    if (result.ok) {
      return {
        status: "success",
        message:
          provider === "resend"
            ? `Email to ${lead.email} accepted by the delivery provider.`
            : `Email prepared locally (simulation) — no external email was sent to ${lead.email}.`,
      };
    }
    if (sendStatus === "unknown") {
      return {
        status: "error",
        message:
          "The send attempt could not be confirmed — the message may have been sent. Wait before attempting again; contact the recipient to verify. Do not resend immediately.",
      };
    }
    return {
      status: "error",
      message: "The delivery provider rejected the message. Nothing was sent.",
    };
  } catch {
    return { status: "error", message: "Could not send the email." };
  }
}

export async function changePasswordAction(
  _prevState: unknown,
  formData: FormData,
): Promise<CrmActionResult> {
  const user = await requireCrmUser();

  const result = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    return { status: "error", message: result.error.issues[0].message };
  }

  const { currentPassword, newPassword } = result.data;

  try {
    const { auth } = await import("@/lib/auth");
    const { headers: nextHeaders } = await import("next/headers");
    const headers = await nextHeaders();

    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false },
    });

    return { status: "success", message: "Password changed successfully." };
  } catch {
    return { status: "error", message: "Could not change password." };
  }
}


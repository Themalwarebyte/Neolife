"use server";

import { revalidatePath } from "next/cache";
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
} from "@/lib/user-management";
import { LeadStatus, MeetingStatus } from "@/generated/prisma/client";

export type CrmActionResult = { status: "success" | "error"; message: string };

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

    if (!UUID.test(targetUserId)) {
      return { status: "error", message: "Invalid assignee." };
    }

    // Validate target: must be a Staff user (not admin, not arbitrary ID).
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, name: true },
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


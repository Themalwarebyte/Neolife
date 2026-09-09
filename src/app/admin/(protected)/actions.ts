"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/server/auth/requireAdmin";
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
import { LeadStatus, MeetingStatus } from "@/generated/prisma/client";

export type CrmActionResult = { status: "success" | "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdminAuthorized(): Promise<boolean> {
  return getAdminUser().then((user) => user !== null);
}

/** Updates a lead's lifecycle status and records a status-change event. */
export async function updateLeadStatus(
  _previous: CrmActionResult | null,
  formData: FormData,
): Promise<CrmActionResult> {
  if (!(await isAdminAuthorized())) {
    return { status: "error", message: "Unauthorized." };
  }
  const id = String(formData.get("id") ?? "");
  const status = parseStatusChange(formData.get("status"));
  if (!UUID.test(id)) return { status: "error", message: "Invalid lead." };
  if (!status) return { status: "error", message: "Invalid status." };

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return { status: "error", message: "Lead not found." };

    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: { status: status as LeadStatus },
      }),
      prisma.leadEvent.create({
        data: { leadId: id, type: "status_changed", metadata: { status } },
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
  if (!(await isAdminAuthorized())) {
    return { status: "error", message: "Unauthorized." };
  }
  const id = String(formData.get("id") ?? "");
  const note = parseFollowUpNote(formData.get("note"));
  if (!UUID.test(id)) return { status: "error", message: "Invalid lead." };
  if (!note) return { status: "error", message: "Please enter a follow-up note." };

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return { status: "error", message: "Lead not found." };

    await prisma.$transaction([
      prisma.followUp.create({ data: { leadId: id, note } }),
      prisma.leadEvent.create({
        data: { leadId: id, type: "follow_up_added" },
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
  if (!(await isAdminAuthorized())) {
    return { status: "error", message: "Unauthorized." };
  }
  const leadId = String(formData.get("leadId") ?? "");
  const scheduledAt = parseScheduledAt(formData.get("scheduledAt"));
  const notes = parseOptionalText(formData.get("notes"));
  if (!UUID.test(leadId)) return { status: "error", message: "Invalid lead." };
  if (!scheduledAt) {
    return { status: "error", message: "Please provide a valid date and time." };
  }
  if (notes === null) return { status: "error", message: "Notes are too long." };

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { status: "error", message: "Lead not found." };

    await prisma.$transaction([
      prisma.meeting.create({
        data: { leadId, scheduledAt, notes: notes ?? null },
      }),
      prisma.leadEvent.create({
        data: {
          leadId,
          type: "meeting_scheduled",
          metadata: { scheduledAt: scheduledAt.toISOString() },
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
  if (!(await isAdminAuthorized())) {
    return { status: "error", message: "Unauthorized." };
  }
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
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
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
        },
      }),
    ]);

    revalidatePath(`/admin/leads/${meeting.leadId}`);
    return { status: "success", message: "Meeting updated." };
  } catch {
    return { status: "error", message: "Could not update the meeting." };
  }
}

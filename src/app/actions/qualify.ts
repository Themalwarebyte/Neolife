"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/prisma";
import { consumeQualificationToken, parseQualificationInput } from "@/lib/qualification";
import { recordFunnelEvent } from "@/lib/funnel";
import { clientKeyFromHeaders, isRateLimited } from "@/lib/rateLimit";

export type QualifyResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

/**
 * Server Action handling public lead qualification (D-030).
 *
 * Security:
 * - Authorization is via the signed, DB-backed single-use qualification token.
 * - The token is consumed atomically (transaction) to prevent replay.
 * - The leadId is extracted from the verified token — never from client form input.
 * - The client cannot choose which lead to update.
 * - Rate limited (10 req/min/IP) to prevent abuse.
 *
 * No authentication is required — this is a public action by the prospect
 * on their own lead via the continuation token.
 */
export async function qualifyLeadAction(
  _previous: QualifyResult | null,
  formData: FormData,
): Promise<QualifyResult> {
  // Rate limiting (shared with lead capture — 5 req/min/IP).
  const headerList = await headers();
  if (isRateLimited(clientKeyFromHeaders(headerList))) {
    return {
      status: "error",
      message: "Too many requests. Please wait a minute and try again.",
    };
  }

  const token = String(formData.get("token") ?? "");
  const notes = formData.get("notes");
  const interestType = formData.get("interestType");
  const city = formData.get("city");

  // Step 1: Validate and atomically consume the token.
  // Returns the bound leadId, or null if invalid/expired/consumed.
  const leadId = await consumeQualificationToken(token);
  if (!leadId) {
    return {
      status: "error",
      message: "This qualification link has expired or is invalid. Please register your interest again.",
    };
  }

  // Step 2: Validate form input.
  const parsed = parseQualificationInput({ notes, interestType, city });
  if (!parsed) {
    return {
      status: "error",
      message: "Please check your answers and try again.",
    };
  }

  try {
    // Step 3: Update the lead (only the lead bound to the token).
    // Status transitions to QUALIFIED per the approved MVP lifecycle (D-003).
    const updateData: Record<string, unknown> = { status: "QUALIFIED" };
    if (parsed.notes !== null) updateData.qualificationNotes = parsed.notes;
    if (parsed.interestType !== null) updateData.interestType = parsed.interestType;
    if (parsed.city !== null) updateData.city = parsed.city;

    await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    // Step 4: Record the authoritative lead_qualified FunnelEvent (server-side only).
    await recordFunnelEvent({
      type: "lead_qualified",
      leadId,
      metadata: {
        fromStatus: "NEW_LEAD",
        toStatus: "QUALIFIED",
      },
    });

    // Step 5: Revalidate CRM pages.
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${leadId}`);

    return {
      status: "success",
      message:
        "Thank you for qualifying your interest. Our office team will review your response and be in touch soon.",
    };
  } catch {
    // Never expose internal errors to the public.
    return {
      status: "error",
      message: "Sorry, something went wrong while recording your qualification. Please try again.",
    };
  }
}

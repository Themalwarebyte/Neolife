"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/prisma";
import { validateQualificationToken } from "@/lib/qualification";
import { clientKeyFromHeaders, isRateLimited } from "@/lib/rateLimit";
import { parseRegisterInterestInput, type RegisterInterestInput } from "@/lib/registration";

export type RegisterInterestResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * Server Action handling the optional post-capture registration-interest step.
 *
 * Security:
 * - Authorization is via the signed, DB-backed qualification token (D-030).
 *   This action VALIDATES the token (non-consuming) so that the optional
 *   qualification form on the same page can still run. The token is NOT
 *   consumed here — that happens only in `qualifyLeadAction`.
 * - The leadId is extracted from the verified token — never from client form input.
 * - The client cannot choose which lead to update.
 * - ProductIds are validated against the database (UUID + existence).
 * - Rate limited (5 req/min/IP).
 */
export async function registerInterestAction(
  _previous: RegisterInterestResult | null,
  formData: FormData,
): Promise<RegisterInterestResult> {
  // Rate limiting (shared with lead capture + qualification).
  const headerList = await headers();
  if (isRateLimited(clientKeyFromHeaders(headerList))) {
    return {
      status: "error",
      message: "Too many requests. Please wait a minute and try again.",
    };
  }

  const token = String(formData.get("token") ?? "");

  // Step 1: Validate the qualification token (non-consuming).
  // Returns the bound leadId, or null if invalid/expired/already-consumed.
  const leadId = await validateQualificationToken(token);
  if (!leadId) {
    return {
      status: "error",
      message:
        "This link has expired or has already been used. Please register your interest again.",
    };
  }

  // Step 2: Validate form input.
  const input: RegisterInterestInput = {
    productId: formData.get("productId"),
    meetingPreference: formData.get("meetingPreference"),
    additionalContext: formData.get("additionalContext"),
  };

  const parsed = parseRegisterInterestInput(input);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    };
  }

  // Step 3: Verify the product exists (prevents fabricating productIds).
  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, name: true },
  });
  if (!product) {
    return {
      status: "error",
      message: "The selected product is not available.",
    };
  }

  try {
    // Step 4: Persist ProductInterest alongside the registration_complete
    // funnel event (D-026, D-005) within a transaction.
    // Note: registration_start is emitted client-side when the form is
    // displayed — it is NOT recorded here.
    await prisma.$transaction(async (tx) => {
      await tx.productInterest.create({
        data: {
          productId: parsed.data.productId,
          leadId,
          status: "NEW",
          message: parsed.data.additionalContext ?? undefined,
        },
      });

      await tx.funnelEvent.create({
        data: {
          type: "registration_complete",
          leadId,
          metadata: {
            productId: parsed.data.productId,
            productName: product.name,
            meetingPreference: parsed.data.meetingPreference,
          },
        },
      });
    });

    // Step 6: Revalidate CRM pages.
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${leadId}`);

    return {
      status: "success",
      message:
        "Your product interest has been recorded. Our office team will review your preferred meeting option and contact you to arrange a discussion.",
    };
  } catch {
    return {
      status: "error",
      message:
        "Sorry, something went wrong while recording your interest. Please try again.",
    };
  }
}

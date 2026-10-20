"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/server/db/prisma";
import { validateQualificationToken } from "@/lib/qualification";
import { clientKeyFromHeaders, isRateLimited } from "@/lib/rateLimit";
import {
  PRODUCT_INTEREST_CATEGORIES,
  parseRegisterInterestInput,
  type RegisterInterestInput,
} from "@/lib/registration";

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
    categorySlug: formData.get("categorySlug"),
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

  // Historical product-specific submissions are still honored. New public
  // submissions select only a category and must NOT be attributed to a random
  // product, since that would misrepresent the prospect's actual interest.
  let product: { id: string; name: string } | null = null;
  if (!parsed.data.categorySlug) {
    product = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, name: true },
    });
    if (!product) {
      return { status: "error", message: "The selected product is not available." };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.categorySlug) {
        const selectedCategory = PRODUCT_INTEREST_CATEGORIES.find(
          (option) => option.slug === parsed.data.categorySlug,
        );
        if (!selectedCategory) throw new Error("Invalid category selection.");
        // Durable, lead-linked CRM audit history. ProductInterest deliberately
        // remains untouched until the prospect chooses an actual product.
        await tx.leadEvent.create({
          data: {
            leadId,
            type: "product_category_interest",
            metadata: {
              categorySlug: selectedCategory.slug,
              categoryName: selectedCategory.name,
              meetingPreference: parsed.data.meetingPreference,
              additionalContext: parsed.data.additionalContext,
            },
          },
        });
        await tx.funnelEvent.create({
          data: {
            type: "registration_complete",
            leadId,
            metadata: {
              categorySlug: selectedCategory.slug,
              categoryName: selectedCategory.name,
              meetingPreference: parsed.data.meetingPreference,
            },
          },
        });
      } else if (product) {
        // Legacy product-specific route (kept for compatibility and tests).
        await tx.productInterest.create({
          data: {
            productId: product.id,
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
              productId: product.id,
              productName: product.name,
              meetingPreference: parsed.data.meetingPreference,
            },
          },
        });
      }
    });

  // Step 6: Revalidate CRM pages.
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${leadId}`);

    return {
      status: "success",
      message:
        "Your area of interest has been recorded. Our team will review your preferred meeting option and contact you to arrange a discussion.",
    };
  } catch {
    return {
      status: "error",
      message:
        "Sorry, something went wrong while recording your interest. Please try again.",
    };
  }
}

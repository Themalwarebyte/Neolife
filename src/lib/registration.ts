/**
 * Phase P-1 — registration/business-interest validation (pure, client-safe).
 *
 * Validates the registration-form input that a prospect submits during the
 * optional post-capture qualification step. This captures ProductInterest
 * persistence (D-026 schema model) and extends the FunnelEvent set
 * (registration_start / registration_complete).
 *
 * Pure & client-safe: no Prisma / generated-client import, so this module
 * can be bundled into a client component without breaking server-shims.
 */

export const MEETING_PREFERENCE_OPTIONS = [
  "video_call",
  "in_person",
  "phone_call",
] as const;

export const INTEREST_STATUS_OPTIONS = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP",
  "CONVERTED",
  "NOT_INTERESTED",
] as const;

// These are the four established NeoLife catalogue categories, plus a
// no-pressure option. We never invent a specific product for a category choice.
export const PRODUCT_INTEREST_CATEGORIES = [
  { slug: "nutritionals", name: "Nutritionals" },
  { slug: "weight-management", name: "Weight Management" },
  { slug: "personal-care", name: "Personal Care" },
  { slug: "home-care", name: "Home Care" },
  { slug: "not-sure-yet", name: "Not sure yet - please advise" },
] as const;

export type ProductInterestCategory = (typeof PRODUCT_INTEREST_CATEGORIES)[number]["slug"];
export type MeetingPreference = (typeof MEETING_PREFERENCE_OPTIONS)[number];
export type InterestStatus = (typeof INTEREST_STATUS_OPTIONS)[number];

export type RegisterInterestInput = {
  productId?: unknown;
  categorySlug?: unknown;
  meetingPreference?: unknown;
  additionalContext?: unknown;
};

export type RegistrationParseResult =
  | { ok: true; data: RegistrationParsedData }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

export interface RegistrationParsedData {
  productId: string; // legacy product-specific route; empty for category selection
  categorySlug: ProductInterestCategory | null;
  meetingPreference: MeetingPreference;
  additionalContext: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONTEXT_LENGTH = 1000;

/** Validates untrusted registration-form input; never throws on bad input. */
export function parseRegisterInterestInput(
  input: RegisterInterestInput,
): RegistrationParseResult {
  const fieldErrors: Record<string, string> = {};

  // Prospect-facing flow asks for a category, never a specific SKU.
  // Legacy productId submissions remain supported for existing integrations.
  const rawCategory = typeof input.categorySlug === "string"
    ? input.categorySlug.trim()
    : "";
  const categorySlug = PRODUCT_INTEREST_CATEGORIES.find(
    (option) => option.slug === rawCategory,
  )?.slug ?? null;
  const productId =
    typeof input.productId === "string" ? input.productId.trim() : "";

  if (rawCategory) {
    if (!categorySlug) fieldErrors.categorySlug = "Please choose a valid product category.";
  } else if (!UUID.test(productId)) {
    fieldErrors.productId = "Please choose a product category.";
  }

  // meetingPreference — required enum
  const meetingPreference =
    typeof input.meetingPreference === "string"
      ? input.meetingPreference.trim()
      : "";
  if (
    !MEETING_PREFERENCE_OPTIONS.includes(
      meetingPreference as MeetingPreference,
    )
  ) {
    fieldErrors.meetingPreference = "Please choose a meeting preference.";
  }

  // additionalContext — optional, constrained length & charset
  let additionalContext: string | null = null;
  if (typeof input.additionalContext === "string") {
    const trimmed = input.additionalContext.trim();
    if (trimmed.length > MAX_CONTEXT_LENGTH) {
      fieldErrors.additionalContext = "Your message is too long.";
    } else if (trimmed.length > 0) {
      additionalContext = trimmed;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    data: {
      productId: categorySlug ? "" : productId,
      categorySlug,
      meetingPreference: meetingPreference as MeetingPreference,
      additionalContext,
    },
  };
}

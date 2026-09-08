"use server";

import { headers } from "next/headers";
import {
  GENERIC_ERROR_MESSAGE,
  findActiveLeadByPhone,
  parseLeadInput,
  persistLead,
  type SubmitLeadInput,
} from "@/lib/leads";
import { clientKeyFromHeaders, isRateLimited } from "@/lib/rateLimit";

export type SubmitLeadResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * Server Action handling public lead submissions.
 * Next.js Server Actions include built-in same-origin checks (CSRF mitigation).
 */
export async function submitLeadAction(
  _previous: SubmitLeadResult | null,
  formData: FormData,
): Promise<SubmitLeadResult> {
  // Basic abuse control (honeypot + rate limit)
  const headerList = await headers();
  if (isRateLimited(clientKeyFromHeaders(headerList))) {
    return {
      status: "error",
      message: "Too many requests. Please wait a minute and try again.",
    };
  }

  const input: SubmitLeadInput = {
    firstName: formData.get("firstName") ?? undefined,
    lastName: formData.get("lastName") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    email: formData.get("email") ?? undefined,
    city: formData.get("city") ?? undefined,
    interestType: formData.get("interestType") ?? undefined,
    consent: formData.get("consent") === "on" ? true : undefined,
    website: formData.get("website") ?? undefined,
  };

  const parsed = parseLeadInput(input);
  if (!parsed.ok) {
    if (parsed.message === "") {
      // Honeypot hit — respond neutrally.
      return { status: "success", message: "" };
    }
    return { status: "error", message: parsed.message, fieldErrors: parsed.fieldErrors };
  }

  try {
    const existing = await findActiveLeadByPhone(parsed.data.phone);
    if (existing) {
      return {
        status: "success",
        message:
          "We already have your details — our team will be in touch soon.",
      };
    }

    await persistLead(parsed.data);
    return {
      status: "success",
      message:
        "Thank you — your interest has been registered. The office team will contact you to answer your questions and, if you would like, arrange a meeting.",
    };
  } catch {
    // Never expose database or internal errors to the public.
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }
}

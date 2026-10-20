import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { clientKeyFromHeaders, isRateLimited } from "@/lib/rateLimit";
import { isValidOfficeEmail, normalizeOfficeEmail } from "@/lib/office-form-validation";

const headers = { "Cache-Control": "no-store, private" };
const neutral = "If this address belongs to an active office account, you will receive a reset link.";

export async function POST(request: NextRequest) {
  const key = `office-password-reset:${clientKeyFromHeaders(request.headers)}`;
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers },
    );
  }

  // Never pretend a reset was emailed if Resend is not configured.
  if (process.env.EMAIL_PROVIDER?.toLowerCase() !== "resend" || !isEmailConfigured()) {
    return NextResponse.json(
      { error: "Password recovery is temporarily unavailable. Please contact the office owner." },
      { status: 503, headers },
    );
  }

  let email: string;
  try {
    const data: unknown = await request.json();
    if (!data || typeof data !== "object" || !("email" in data)) throw new Error();
    const value = (data as { email?: unknown }).email;
    if (typeof value !== "string" || !isValidOfficeEmail(value)) throw new Error();
    email = normalizeOfficeEmail(value);
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers });
  }

  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/admin/reset-password" },
      headers: request.headers,
    });
  } catch {
    // Intentionally do not reveal account existence or reset-token details.
    console.warn("[auth] Password reset request was not accepted.");
  }
  return NextResponse.json({ message: neutral }, { headers });
}

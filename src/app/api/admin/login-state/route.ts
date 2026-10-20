import { NextResponse } from "next/server";
import { getCrmUser } from "@/server/auth/requireCrmUser";
import { getCrmLoginDestination } from "@/lib/crm-login-policy";

export const dynamic = "force-dynamic";

/** The client must not treat a successful Better Auth sign-in as CRM access. */
export async function GET() {
  const user = await getCrmUser();
  const destination = user ? getCrmLoginDestination({
    isActive: true,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  }) : null;
  if (!destination) {
    return NextResponse.json(
      { error: "Office access is unavailable." },
      { status: 403, headers: { "Cache-Control": "no-store, private" } },
    );
  }
  return NextResponse.json(
    { destination },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
